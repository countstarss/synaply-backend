#!/bin/bash

# 🚀 超简单测试脚本
# 一键运行所有测试，无需复杂配置

echo "🧪 开始运行 Synaply 测试..."
echo "================================"

# 检查基础环境
echo "📋 1/4 检查环境..."
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "⚠️  警告：未找到 .env 文件，将使用默认配置"
else
    echo "✅ 找到 .env 文件"
fi

# 检查数据库连接
echo "📋 2/4 检查数据库连接..."
if ! pnpm exec prisma db push --force-reset > /dev/null 2>&1; then
    echo "❌ 数据库连接失败，请检查 DATABASE_URL"
    echo "💡 提示：确保数据库服务正在运行"
    exit 1
fi
echo "✅ 数据库连接成功"

# 安装依赖
echo "📋 3/4 检查依赖..."
if ! pnpm install > /dev/null 2>&1; then
    echo "❌ 依赖安装失败"
    exit 1
fi
echo "✅ 依赖检查完成"

# 运行测试
echo "📋 4/4 运行测试..."
echo "================================"
echo "🔍 测试进度："

# 使用更详细的输出格式
if pnpm run test:e2e --verbose 2>&1 | tee test_output.log; then
    echo ""
    echo "================================"
    echo "✅ 测试完成！"
    
    # 提取测试结果摘要
    if grep -q "PASS" test_output.log; then
        PASSED=$(grep -c "PASS" test_output.log || echo "0")
        echo "🎉 通过的测试套件: $PASSED"
    fi
    
    if grep -q "FAIL" test_output.log; then
        FAILED=$(grep -c "FAIL" test_output.log || echo "0")
        echo "❌ 失败的测试套件: $FAILED"
        echo ""
        echo "🔍 主要错误："
        grep -A 3 "FAIL" test_output.log | head -10
    fi
    
    if grep -q "Tests:" test_output.log; then
        echo ""
        echo "📊 详细统计："
        grep "Tests:" test_output.log | tail -1
    fi
    
    echo ""
    echo "📄 完整日志已保存到: test_output.log"
    echo "💡 查看详细日志: cat test_output.log"
    
else
    echo ""
    echo "❌ 测试执行失败"
    echo "📄 检查日志: cat test_output.log"
    exit 1
fi

echo ""
echo "�� 测试完成！如有问题请查看日志文件。" 