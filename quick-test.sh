#!/bin/bash

# 快速测试验证脚本
# 用于验证测试环境是否正确配置

echo "🔍 快速测试验证..."
echo "================================"

# 设置颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查函数
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅ $1 已安装: $(command -v $1)${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 未找到${NC}"
        return 1
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ 文件存在: $1${NC}"
        return 0
    else
        echo -e "${RED}❌ 文件不存在: $1${NC}"
        return 1
    fi
}

# 1. 检查基础环境
echo -e "${BLUE}1. 检查基础环境...${NC}"
check_command "node"
check_command "pnpm"
check_command "npx"

# 2. 检查项目文件
echo -e "\n${BLUE}2. 检查项目文件...${NC}"
check_file "package.json"
check_file "tsconfig.json"
check_file "test/jest-e2e.json"
check_file "test/chat.e2e-spec.ts"
check_file "test/message.e2e-spec.ts"

# 3. 检查依赖
echo -e "\n${BLUE}3. 检查关键依赖...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules 目录存在${NC}"
    
    # 检查关键包
    key_packages=("@nestjs/testing" "jest" "supertest" "@types/jest" "ts-jest")
    for package in "${key_packages[@]}"; do
        if [ -d "node_modules/$package" ]; then
            echo -e "${GREEN}✅ $package 已安装${NC}"
        else
            echo -e "${RED}❌ $package 未安装${NC}"
        fi
    done
else
    echo -e "${RED}❌ node_modules 目录不存在，请运行 'pnpm install'${NC}"
fi

# 4. 检查测试配置
echo -e "\n${BLUE}4. 检查测试配置...${NC}"

# 检查 Jest 配置
if grep -q "jest" package.json; then
    echo -e "${GREEN}✅ Jest 配置存在于 package.json${NC}"
else
    echo -e "${RED}❌ Jest 配置缺失${NC}"
fi

# 检查测试脚本
if grep -q "test:e2e" package.json; then
    echo -e "${GREEN}✅ E2E 测试脚本配置存在${NC}"
else
    echo -e "${RED}❌ E2E 测试脚本配置缺失${NC}"
fi

# 5. 运行简单的语法检查
echo -e "\n${BLUE}5. 运行语法检查...${NC}"
if pnpm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript 编译通过${NC}"
else
    echo -e "${RED}❌ TypeScript 编译失败${NC}"
    echo -e "${YELLOW}请检查代码语法错误${NC}"
fi

# 6. 测试数据库连接 (如果 Prisma 可用)
echo -e "\n${BLUE}6. 检查数据库配置...${NC}"
if [ -f "prisma/schema.prisma" ]; then
    echo -e "${GREEN}✅ Prisma schema 文件存在${NC}"
    
    if command -v prisma &> /dev/null; then
        echo -e "${GREEN}✅ Prisma CLI 可用${NC}"
    else
        echo -e "${YELLOW}⚠️  Prisma CLI 未找到，使用 npx prisma${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Prisma schema 文件不存在${NC}"
fi

# 7. 运行简单测试
echo -e "\n${BLUE}7. 运行简单测试验证...${NC}"
echo -e "${YELLOW}正在运行基础测试...${NC}"

# 运行一个简单的 jest 测试来验证配置
if pnpm run test -- --passWithNoTests --silent; then
    echo -e "${GREEN}✅ Jest 配置正常${NC}"
else
    echo -e "${RED}❌ Jest 配置有问题${NC}"
fi

# 检查 E2E 测试文件语法
echo -e "${YELLOW}正在检查 E2E 测试文件语法...${NC}"
if npx tsc --noEmit test/chat.e2e-spec.ts test/message.e2e-spec.ts; then
    echo -e "${GREEN}✅ E2E 测试文件语法正确${NC}"
else
    echo -e "${RED}❌ E2E 测试文件有语法错误${NC}"
fi

# 总结
echo -e "\n================================"
echo -e "${BLUE}📊 验证总结${NC}"
echo -e "如果所有检查都通过，您可以运行完整测试："
echo -e "${YELLOW}./test-runner.sh${NC}"
echo -e "\n如果有任何问题，请参考 TEST_DOCUMENTATION.md"

echo -e "\n${GREEN}验证完成！${NC}" 