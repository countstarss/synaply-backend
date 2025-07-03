// import * as request from 'supertest';
// import { INestApplication } from '@nestjs/common';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { JwtService } from '@nestjs/jwt';
// import {
//   CreateGroupChatDto,
//   CreatePrivateChatDto,
// } from '../src/chat/dto/create-chat.dto';

// declare global {
//   namespace NodeJS {
//     interface Global {
//       app: INestApplication;
//       prisma: PrismaService;
//     }
//   }
// }

// describe('ChatController (e2e)', () => {
//   let app: INestApplication;
//   let prisma: PrismaService;
//   let jwtService: JwtService;

//   let testUser, anotherUser, thirdUser;
//   let testTeamMember, anotherTeamMember, thirdTeamMember;
//   let testAccessToken, anotherAccessToken;

//   beforeAll(async () => {
//     app = global.app;
//     prisma = global.prisma;
//     jwtService = app.get<JwtService>(JwtService);

//     // Create users & team
//     testUser = await prisma.user.create({
//       data: { email: 'chat-test1@test.com' },
//     });
//     anotherUser = await prisma.user.create({
//       data: { email: 'chat-test2@test.com' },
//     });
//     const team = await prisma.team.create({ data: { name: 'Chat Test Team' } });

//     testTeamMember = await prisma.teamMember.create({
//       data: { userId: testUser.id, teamId: team.id },
//     });
//     anotherTeamMember = await prisma.teamMember.create({
//       data: { userId: anotherUser.id, teamId: team.id },
//     });

//     testAccessToken = jwtService.sign({
//       sub: testUser.id,
//       email: testUser.email,
//       teamMemberId: testTeamMember.id,
//     });
//     anotherAccessToken = jwtService.sign({
//       sub: anotherUser.id,
//       email: anotherUser.email,
//       teamMemberId: anotherTeamMember.id,
//     });
//   });

//   afterEach(async () => {
//     await prisma.chatMember.deleteMany({});
//     await prisma.chat.deleteMany({});
//   });

//   afterAll(async () => {
//     await prisma.teamMember.deleteMany({});
//     await prisma.team.deleteMany({});
//     await prisma.user.deleteMany({});
//   });

//   it('POST /chats/group - should create a group chat', () => {
//     const dto: CreateGroupChatDto = {
//       name: 'Test Group',
//       memberIds: [testTeamMember.id, anotherTeamMember.id],
//     };
//     return request(app.getHttpServer())
//       .post('/chats/group')
//       .set('Authorization', `Bearer ${testAccessToken}`)
//       .send(dto)
//       .expect(201);
//   });

//   it('POST /chats/private - should create a private chat', () => {
//     const dto: CreatePrivateChatDto = {
//       targetMemberId: anotherTeamMember.id,
//     };
//     return request(app.getHttpServer())
//       .post('/chats/private')
//       .set('Authorization', `Bearer ${testAccessToken}`)
//       .send(dto)
//       .expect(201);
//   });
// });
