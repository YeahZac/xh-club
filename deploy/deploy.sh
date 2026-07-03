#!/bin/bash
# ============================================================
# 星河百谷商会平台 - 一键部署脚本
# 适用于：Ubuntu 20.04+ / CentOS 7+ / Debian 10+
# ============================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------- 检查环境 ----------
check_env() {
    log_info "检查服务器环境..."
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_warn "Docker 未安装，正在安装..."
        curl -fsSL https://get.docker.com | sh
        systemctl start docker
        systemctl enable docker
        log_info "Docker 安装完成"
    else
        log_info "Docker 已安装: $(docker --version)"
    fi

    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_warn "Docker Compose 未安装，正在安装..."
        apt-get update && apt-get install -y docker-compose-plugin 2>/dev/null || \
        pip3 install docker-compose 2>/dev/null || \
        curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose && \
        chmod +x /usr/local/bin/docker-compose
        log_info "Docker Compose 安装完成"
    else
        log_info "Docker Compose 已安装"
    fi
}

# ---------- 配置环境变量 ----------
setup_env() {
    if [ ! -f .env ]; then
        log_warn "未找到 .env 文件，正在创建..."
        cp .env.example .env
        log_error "请编辑 .env 文件，填入实际的环境变量值后重新运行部署脚本"
        echo ""
        echo "  vi .env"
        echo ""
        echo "必须填写的变量："
        echo "  COZE_SUPABASE_URL       - Supabase 项目URL"
        echo "  COZE_SUPABASE_ANON_KEY  - Supabase 匿名密钥"
        echo "  COZE_SUPABASE_SERVICE_ROLE_KEY - Supabase 服务密钥"
        echo "  PROJECT_DOMAIN          - 项目域名"
        echo "  JWT_SECRET              - JWT加密密钥"
        exit 1
    fi
    log_info "环境变量配置完成"
}

# ---------- 构建和启动 ----------
deploy() {
    log_info "开始构建和部署..."

    # 回到项目根目录构建后端
    cd /opt/xinghe-chamber/server
    
    # 安装依赖
    log_info "安装后端依赖..."
    pnpm install --frozen-lockfile
    
    # 构建
    log_info "构建后端..."
    pnpm build
    
    # 确保 admin-panel 复制到 dist
    cp -r src/admin-panel dist/admin-panel
    
    # 回到部署目录
    cd /opt/xinghe-chamber/deploy
    
    # 启动 Docker Compose
    log_info "启动服务..."
    docker compose down 2>/dev/null || true
    docker compose up -d --build
    
    log_info "等待服务启动..."
    sleep 10
    
    # 健康检查
    if curl -s http://localhost:3000/api/health | grep -q "ok"; then
        log_info "后端服务启动成功！"
    else
        log_warn "后端服务可能还在启动中，请稍后检查"
    fi
}

# ---------- 配置 SSL ----------
setup_ssl() {
    log_info "配置 SSL 证书..."
    
    if [ ! -f .env ]; then
        log_error "请先配置 .env 文件"
        exit 1
    fi
    
    source .env
    
    if [ -z "$PROJECT_DOMAIN" ] || [ "$PROJECT_DOMAIN" = "https://your-domain.com" ]; then
        log_error "请在 .env 中配置 PROJECT_DOMAIN 变量"
        exit 1
    fi
    
    DOMAIN=$(echo $PROJECT_DOMAIN | sed 's|https\?://||' | sed 's|/.*||')
    
    log_info "为域名 $DOMAIN 申请 SSL 证书..."
    
    # 安装 certbot
    apt-get update && apt-get install -y certbot
    
    # 申请证书
    certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --email admin@$DOMAIN --agree-tos --non-interactive
    
    # 更新 Nginx 配置启用 HTTPS
    log_info "SSL 证书获取成功，请编辑 nginx.conf 取消 HTTPS 部分的注释"
    log_info "然后运行: docker compose restart nginx"
}

# ---------- 查看日志 ----------
show_logs() {
    cd /opt/xinghe-chamber/deploy
    docker compose logs -f --tail=100
}

# ---------- 停止服务 ----------
stop_service() {
    cd /opt/xinghe-chamber/deploy
    docker compose down
    log_info "服务已停止"
}

# ---------- 重启服务 ----------
restart_service() {
    cd /opt/xinghe-chamber/deploy
    docker compose restart
    log_info "服务已重启"
}

# ---------- 主菜单 ----------
main() {
    echo ""
    echo "=========================================="
    echo "    星河百谷商会平台 - 部署管理工具"
    echo "=========================================="
    echo ""
    echo "1) 首次部署（安装环境 + 构建部署）"
    echo "2) 更新部署（拉取代码 + 重新构建）"
    echo "3) 配置 SSL 证书"
    echo "4) 查看日志"
    echo "5) 重启服务"
    echo "6) 停止服务"
    echo "7) 退出"
    echo ""
    read -p "请选择操作 [1-7]: " choice
    
    case $choice in
        1) check_env && setup_env && deploy ;;
        2) deploy ;;
        3) setup_ssl ;;
        4) show_logs ;;
        5) restart_service ;;
        6) stop_service ;;
        7) exit 0 ;;
        *) log_error "无效选择" && exit 1 ;;
    esac
}

main "$@"
