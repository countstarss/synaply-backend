import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const port = Number.parseInt(process.env.PORT ?? '5678', 10);

  // 配置CORS
  app.enableCors({
    origin: allowedOrigins, // 允许的前端域名
    credentials: true, // 允许携带cookie
  });

  // 配置Swagger
  const config = new DocumentBuilder()
    .setTitle('Synaply API')
    .setDescription('Synaply项目的API文档')
    .setVersion('1.0')
    .addTag('api')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: '输入JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(Number.isNaN(port) ? 5678 : port);
}
bootstrap();
