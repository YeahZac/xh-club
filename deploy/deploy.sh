#!/bin/bash
#============================================================
# 粤商汇 - 一键部署脚本
# 用法: bash deploy.sh [选项]
#
# 选项:
#   --full      完整部署 (前端+后端)
#   --frontend  仅部署前端
#   --backend   仅部署后端
#   --rollback  回滚到上一版本
#============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 配置
APP_DIR="/var/www/yueshanghui"
BACKUP_DIR="/var/www/yueshanghui-backup"
DEPLOY_MODE="${1:---full}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 显示帮助
show_help() {
    echo ""
    echo "粤商汇 - 一键部署脚本"
    echo ""
    echo "用法: bash deploy.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --full      完整部署 (前端+后端) [默认]"
    echo "  --frontend  仅部署前端"
    echo "  --backend   仅部署后端"
    echo "  --rollback  回滚到上一版本"
    echo "  --status    查看部署状态"
    echo "  --help      显示帮助"
    echo ""
}

# 检查环境
check_environment() {
    log_info "检查部署环境..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先运行 setup-server.sh"
        exit 1
    fi
    
    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm 未安装"
        exit 1
    fi
    
    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装"
        exit 1
    fi
    
    # 检查 Nginx
    if ! command -v nginx &> /dev/null; then
        log_warn "Nginx 未安装"
    fi
    
    log_success "环境检查通过"
}

# 备份当前版本
backup_current() {
    log_info "备份当前版本..."
    
    mkdir -p $BACKUP_DIR
    
    # 备份后端
    if [ -d "$APP_DIR/server/dist" ]; then
        tar -czf "$BACKUP_DIR/server_$TIMESTAMP.tar.gz" -C $APP_DIR server/dist
        log_info "后端已备份: server_$TIMESTAMP.tar.gz"
    fi
    
    # 备份前端
    if [ -d "$APP_DIR/dist-web" ]; then
        tar -czf "$BACKUP_DIR/frontend_$TIMESTAMP.tar.gz" -C $APP_DIR dist-web
        log_info "前端已备份: frontend_$TIMESTAMP.tar.gz"
    fi
    
    # 保留最近5个备份
    cd $BACKUP_DIR
    ls -t server_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm --
    ls -t frontend_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm --
    
    log_success "备份完成"
}

# 部署后端
deploy_backend() {
    log_info "开始部署后端..."
    
    cd $APP_DIR
    
    # 安装依赖
    log_info "安装后端依赖..."
    cd server
    pnpm install --frozen-lockfile --prod=false
    
    # 构建
    log_info "构建后端代码..."
    pnpm build
    
    # 重启服务
    log_info "重启后端服务..."
    cd $APP_DIR
    
    # 停止旧进程
    pm2 delete yueshanghui-api 2>/dev/null || true
    
    # 启动新进程
    pm2 start deploy/ecosystem.config.js
    
    # 保存 PM2 配置
    pm2 save
    
    log_success "后端部署完成"
}

# 部署前端
deploy_frontend() {
    log_info "开始部署前端..."
    
    cd $APP_DIR
    
    # 安装依赖
    log_info "安装前端依赖..."
    pnpm install --frozen-lockfile
    
    # 构建 H5 版本
    log_info "构建前端代码..."
    pnpm build:web
    
    # 构建微信小程序 (可选)
    # log_info "构建微信小程序..."
    # pnpm build:weapp
    
    log_success "前端部署完成"
}

# 配置 Nginx
setup_nginx() {
    log_info "配置 Nginx..."
    
    # 复制配置文件
    cp $APP_DIR/deploy/nginx.conf /etc/nginx/sites-available/yueshanghui.conf
    
    # 创建软链接
    ln -sf /etc/nginx/sites-available/yueshanghui.conf /etc/nginx/sites-enabled/yueshanghui.conf
    
    # 移除默认配置
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试配置
    nginx -t
    
    # 重载 Nginx
    systemctl reload nginx
    
    log_success "Nginx 配置完成"
}

# 回滚
rollback() {
    log_info "执行回滚..."
    
    cd $BACKUP_DIR
    
    # 查找最新备份
    LATEST_SERVER=$(ls -t server_*.tar.gz 2>/dev/null | head -1)
    LATEST_FRONTEND=$(ls -t frontend_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_SERVER" ] && [ -z "$LATEST_FRONTEND" ]; then
        log_error "没有找到可回滚的备份"
        exit 1
    fi
    
    # 停止服务
    pm2 stop yueshanghui-api 2>/dev/null || true
    
    # 回滚后端
    if [ -n "$LATEST_SERVER" ]; then
        log_info "回滚后端: $LATEST_SERVER"
        rm -rf $APP_DIR/server/dist
        tar -xzf "$BACKUP_DIR/$LATEST_SERVER" -C $APP_DIR
    fi
    
    # 回滚前端
    if [ -n "$LATEST_FRONTEND" ]; then
        log_info "回滚前端: $LATEST_FRONTEND"
        rm -rf $APP_DIR/dist-web
        tar -xzf "$BACKUP_DIR/$LATEST_FRONTEND" -C $APP_DIR
    fi
    
    # 重启服务
    pm2 restart yueshanghui-api 2>/dev/null || pm2 start deploy/ecosystem.config.js
    
    log_success "回滚完成"
}

# 显示状态
show_status() {
    echo ""
    echo "============================================================"
    echo "       粤商汇 - 部署状态"
    echo "============================================================"
    echo ""
    
    # PM2 状态
    echo "【PM2 进程状态】"
    pm2 list
    echo ""
    
    # Nginx 状态
    echo "【Nginx 状态】"
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}Nginx 运行中${NC}"
    else
        echo -e "${RED}Nginx 未运行${NC}"
    fi
    echo ""
    
    # 磁盘使用
    echo "【磁盘使用】"
    df -h $APP_DIR | tail -1
    echo ""
    
    # 最近部署
    echo "【最近备份】"
    ls -lt $BACKUP_DIR/*.tar.gz 2>/dev/null | head -5 || echo "暂无备份"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "============================================================"
    echo "       粤商汇 - 一键部署脚本"
    echo "============================================================"
    echo ""
    
    case $DEPLOY_MODE in
        --full)
            check_environment
            backup_current
            deploy_backend
            deploy_frontend
            setup_nginx
            ;;
        --frontend)
            check_environment
            backup_current
            deploy_frontend
            ;;
        --backend)
            check_environment
            backup_current
            deploy_backend
            ;;
        --rollback)
            rollback
            ;;
        --status)
            show_status
            ;;
        --help|-h)
            show_help
            ;;
        *)
            log_error "未知选项: $DEPLOY_MODE"
            show_help
            exit 1
            ;;
    esac
    
    echo ""
    echo "============================================================"
    log_success "部署完成!"
    echo "============================================================"
    echo ""
    echo "访问地址:"
    echo "  - H5: http://your-domain.com"
    echo "  - API: http://your-domain.com/api"
    echo ""
    echo "常用命令:"
    echo "  - 查看日志: pm2 logs yueshanghui-api"
    echo "  - 重启服务: pm2 restart yueshanghui-api"
    echo "  - 查看状态: bash deploy.sh --status"
    echo ""
}

main
