/* eslint-disable */
// Mock implementation of jose library for testing

const jwtVerify = async (token, secret, options) => {
  // 模拟JWT验证逻辑
  // 在测试环境中，我们允许任何符合基本格式的JWT token通过验证

  try {
    // 检查token是否是JWT格式 (三个部分用.分隔)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // 尝试解码payload部分（Base64解码）
    const payloadPart = parts[1];
    // 添加padding如果需要
    const paddedPayload =
      payloadPart + '='.repeat((4 - (payloadPart.length % 4)) % 4);
    const decodedPayload = JSON.parse(atob(paddedPayload));

    // 检查必要的字段
    if (!decodedPayload.sub || !decodedPayload.email) {
      throw new Error('Missing required payload fields');
    }

    // 返回成功的验证结果
    return {
      payload: {
        sub: decodedPayload.sub,
        email: decodedPayload.email,
        exp: decodedPayload.exp || Date.now() / 1000 + 3600, // 如果没有exp，默认1小时后过期
        iat: decodedPayload.iat || Date.now() / 1000,
        ...decodedPayload, // 包含其他所有字段
      },
    };
  } catch (error) {
    // 如果解码失败，抛出验证错误
    throw new Error('Invalid token');
  }
};

module.exports = {
  jwtVerify,
};
