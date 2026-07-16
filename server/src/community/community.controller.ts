import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common'
import { CommunityService } from './community.service'
import { MemberAuthGuard } from '@/auth/auth.guard'

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  async getPosts(@Query() query: any) {
    console.log('[CommunityController] GET /api/community/posts')
    const result = await this.communityService.getPosts(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get('posts/:id')
  async getPost(@Param('id') id: string) {
    console.log('[CommunityController] GET /api/community/posts/:id')
    const result = await this.communityService.getPostDetail(id)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('posts')
  @UseGuards(MemberAuthGuard)
  async createPost(@Body() dto: any, @Req() request: any) {
    console.log('[CommunityController] POST /api/community/posts')
    const result = await this.communityService.createPost({ ...dto, member_id: request.user.sub })
    return { code: 200, msg: '发布成功', data: result }
  }

  @Post('posts/:id/like')
  @UseGuards(MemberAuthGuard)
  async likePost(@Param('id') id: string, @Req() request: any) {
    console.log('[CommunityController] POST /api/community/posts/:id/like')
    const result = await this.communityService.likePost({ post_id: id, member_id: request.user.sub })
    return { code: 200, msg: '点赞成功', data: result }
  }

  @Get('resources')
  async getResources(@Query() query: any) {
    console.log('[CommunityController] GET /api/community/resources')
    const result = await this.communityService.getResources(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('posts/:id/comment')
  @UseGuards(MemberAuthGuard)
  async commentPost(@Param('id') id: string, @Body() body: any, @Req() request: any) {
    console.log('[CommunityController] POST /api/community/posts/:id/comment')
    const result = await this.communityService.commentPost({ ...body, post_id: id, member_id: request.user.sub })
    return { code: 200, msg: '评论成功', data: result }
  }
}
