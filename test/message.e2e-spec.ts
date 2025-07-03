// import * as request from 'supertest';
// import { INestApplication } from '@nestjs/common';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { JwtService } from '@nestjs/jwt';
// import { CreateMessageDto } from 'src/message/dto/create-message.dto';

// declare global {
//   namespace NodeJS {
//     interface Global {
//       app: INestApplication;
//       prisma: PrismaService;
//     }
//   }
// }

// describe('MessageController (e2e)', () => {
//   let app: INestApplication;
//   let prisma: PrismaService;
//   let jwtService: JwtService;

//   let testUser, anotherUser;
//   let testTeamMember, anotherTeamMember;
//   let testAccessToken, anotherAccessToken;
//   let chat;

//   beforeAll(async () => {
//     app = global.app;
//     prisma = global.prisma;
//     jwtService = app.get<JwtService>(JwtService);

//     testUser = await prisma.user.create({
//       data: { email: 'msg-user1@test.com' },
//     });
//     anotherUser = await prisma.user.create({
//       data: { email: 'msg-user2@test.com' },
//     });
//     const team = await prisma.team.create({ data: { name: 'Message Team' } });
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

//   beforeEach(async () => {
//     // Create a fresh chat for each test
//     chat = await prisma.chat.create({
//       data: {
//         type: 'GROUP',
//         name: 'Message Test Chat',
//         creatorId: testTeamMember.id,
//         members: {
//           create: [
//             { teamMemberId: testTeamMember.id },
//             { teamMemberId: anotherTeamMember.id },
//           ],
//         },
//       },
//     });
//   });

//   afterEach(async () => {
//     // Clean up messages and chats after each test
//     await prisma.message.deleteMany({});
//     await prisma.chat.deleteMany({});
//   });

//   afterAll(async () => {
//     // Clean up all data at the end
//     await prisma.teamMember.deleteMany({});
//     await prisma.team.deleteMany({});
//     await prisma.user.deleteMany({});
//   });

//   it('POST /chats/:chatId/messages - should send a message successfully', () => {
//     const dto: CreateMessageDto = { content: 'Hello', type: 'TEXT' };
//     return request(app.getHttpServer())
//       .post(`/chats/${chat.id}/messages`)
//       .set('Authorization', `Bearer ${testAccessToken}`)
//       .send(dto)
//       .expect(201)
//       .then((res) => {
//         expect(res.body.content).toBe(dto.content);
//         expect(res.body.senderId).toBe(testTeamMember.id);
//       });
//   });

//   it('GET /chats/:chatId/messages - should get messages successfully', async () => {
//     // Create a message first
//     await prisma.message.create({
//       data: {
//         content: 'A test message',
//         type: 'TEXT',
//         chatId: chat.id,
//         senderId: testTeamMember.id,
//       },
//     });

//     return request(app.getHttpServer())
//       .get(`/chats/${chat.id}/messages`)
//       .set('Authorization', `Bearer ${testAccessToken}`)
//       .expect(200)
//       .then((res) => {
//         expect(res.body).toHaveLength(1);
//         expect(res.body[0].content).toBe('A test message');
//       });
//   });
// });
