import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto, FindCommentsDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CommentDto } from './dto/comment.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@ApiTags('comments')
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建评论' })
  @ApiResponse({
    status: 201,
    description: '评论创建成功',
    type: CommentDto,
  })
  create(@Body() createCommentDto: CreateCommentDto, @Req() req) {
    // 从JWT中获取用户关联的TeamMember ID

    const userId = req.user?.sub;
    return this.commentService.create(createCommentDto, userId);
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取评论列表' })
  @ApiResponse({
    status: 200,
    description: '返回评论列表',
    type: [CommentDto],
  })
  findAll(@Query() findCommentsDto: FindCommentsDto) {
    return this.commentService.findAll(findCommentsDto);
  }
}
