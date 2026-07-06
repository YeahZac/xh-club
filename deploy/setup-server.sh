#!/bin/bash
#============================================================
# 粤商汇 - 服务器环境初始化脚本
# 适用于: Ubuntu 20.04/22.04/24.04, CentOS 7/8, Alibaba Cloud Linux
# 用法: sudo bash setup-server.sh
#============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 root 权限
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 sudo 运行此脚本"
        exit 1
    fi
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    log_info "检测到操作系统: $OS $OS_VERSION"
}

# 安装 Node.js 20
install_nodejs() {
    log_info "正在安装 Node.js 20..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            log_success "Node.js $(node -v) 已安装"
            return
        fi
    fi
    
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif [[ "$OS" == "centos" || "$OS" == "rhel" || "$OS" == "alinux" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    fi
    
    # 安装 pnpm
    npm install -g pnpm
    
    log_success "Node.js $(node -v) 安装完成"
    log_success "pnpm $(pnpm -v) 安装完成"
}

# 安装 PM2
install_pm2() {
    log_info "正在安装 PM2..."
    
    if command -v pm2 &> /dev/null; then
        log_success "PM2 $(pm2 -v) 已安装"
        return
    fi
    
    npm install -g pm2
    
    # 设置 PM2 开机自启
    pm2 startup systemd -u root --hp /root
    pm2 save
    
    log_success "PM2 安装完成"
}

# 安装 Nginx
install_nginx() {
    log_info "正在安装 Nginx..."
    
    if command -v nginx &> /dev/null; then
        log_success "Nginx $(nginx -v 2>&1 | cut -d'/' -f2) 已安装"
        return
    fi
    
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        apt-get update
        apt-get install -y nginx
    elif [[ "$OS" == "centos" || "$OS" == "rhel" || "$OS" == "alinux" ]]; then
        yum install -y epel-release
        yum install -y nginx
    fi
    
    systemctl enable nginx
    systemctl start nginx
    
    log_success "Nginx 安装完成"
}

# 安装 PostgreSQL (可选)
install_postgresql() {
    log_info "正在安装 PostgreSQL 15..."
    
    if command -v psql &> /dev/null; then
        log_success "PostgreSQL 已安装"
        return
    fi
    
    read -p "是否安装 PostgreSQL? (如果使用 Supabase 可跳过) [y/N]: " install_pg
    if [[ ! "$install_pg" =~ ^[Yy]$ ]]; then
        log_warn "跳过 PostgreSQL 安装"
        return
    fi
    
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
        apt-get update
        apt-get install -y postgresql-15
    elif [[ "$OS" == "centos" || "$OS" == "rhel" || "$OS" == "alinux" ]]; then
        yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm
        yum install -y postgresql15-server
        /usr/pgsql-15/bin/postgresql-15-setup initdb
        systemctl enable postgresql-15
        systemctl start postgresql-15
    fi
    
    systemctl enable postgresql 2>/dev/null || systemctl enable postgresql-15
    systemctl start postgresql 2>/dev/null || systemctl start postgresql-15
    
    log_success "PostgreSQL 安装完成"
}

# 安装 Git
install_git() {
    log_info "正在安装 Git..."
    
    if command -v git &> /dev/null; then
        log_success "Git $(git --version) 已安装"
        return
    fi
    
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        apt-get install -y git
    elif [[ "$OS" == "centos" || "$OS" == "rhel" || "$OS" == "alinux" ]]; then
        yum install -y git
    fi
    
    log_success "Git 安装完成"
}

# 配置防火墙
setup_firewall() {
    log_info "正在配置防火墙..."
    
    # UFW (Ubuntu)
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 3000/tcp
        log_success "UFW 规则已添加"
    fi
    
    # firewalld (CentOS)
    if command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --permanent --add-port=3000/tcp
        firewall-cmd --reload
        log_success "Firewalld 规则已添加"
    fi
    
    log_warn "请同时在阿里云控制台安全组中开放 80/443/3000 端口"
}

# 创建应用目录
setup_directories() {
    log_info "正在创建应用目录..."
    
    APP_DIR="/var/www/yueshanghui"
    
    mkdir -p $APP_DIR
    mkdir -p $APP_DIR/logs
    mkdir -p $APP_DIR/uploads
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled
    
    log_success "目录创建完成: $APP_DIR"
}

# 安装 Certbot (SSL证书)
install_certbot() {
    log_info "正在安装 Certbot..."
    
    if command -v certbot &> /dev/null; then
        log_success "Certbot 已安装"
        return
    fi
    
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        apt-get install -y certbot python3-certbot-nginx
    elif [[ "$OS" == "centos" || "$OS" == "rhel" || "$OS" == "alinux" ]]; then
        yum install -y epel-release
        yum install -y certbot python3-certbot-nginx
    fi
    
    log_success "Certbot 安装完成"
    log_info "申请SSL证书命令: certbot --nginx -d your-domain.com"
}

# 主函数
main() {
    echo ""
    echo "============================================================"
    echo "       粤商汇 - 服务器环境初始化脚本"
    echo "============================================================"
    echo ""
    
    check_root
    detect_os
    
    echo ""
    echo "即将安装以下组件:"
    echo "  - Node.js 20"
    echo "  - pnpm"
    echo "  - PM2 (进程管理)"
    echo "  - Nginx (反向代理)"
    echo "  - Git"
    echo "  - Certbot (SSL证书)"
    echo ""
    
    read -p "是否继续? [Y/n]: " confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        log_warn "已取消安装"
        exit 0
    fi
    
    install_nodejs
    install_pm2
    install_nginx
    install_git
    install_certbot
    install_postgresql
    setup_firewall
    setup_directories
    
    echo ""
    echo "============================================================"
    log_success "服务器环境初始化完成!"
    echo "============================================================"
    echo ""
    echo "已安装组件:"
    echo "  - Node.js: $(node -v)"
    echo "  - pnpm: $(pnpm -v)"
    echo "  - PM2: $(pm2 -v)"
    echo "  - Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"
    echo ""
    echo "下一步:"
    echo "  1. 上传项目代码到 /var/www/yueshanghui/"
    echo "  2. 配置环境变量: cp .env.example .env && vim .env"
    echo "  3. 运行部署脚本: bash deploy/deploy.sh"
    echo ""
}

main "$@"
