import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common'
import { CommunityService } from './community.service'

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
  async createPost(@Body() dto: any) {
    console.log('[CommunityController] POST /api/community/posts')
    const result = await this.communityService.createPost(dto)
    return { code: 200, msg: '发布成功', data: result }
  }

  @Post('posts/:id/like')
  async likePost(@Param('id') id: string, @Body() body: any) {
    console.log('[CommunityController] POST /api/community/posts/:id/like')
    const result = await this.communityService.likePost({ post_id: id, member_id: body.member_id || '0' })
    return { code: 200, msg: '点赞成功', data: result }
  }

  @Get('resources')
  async getResources(@Query() query: any) {
    console.log('[CommunityController] GET /api/community/resources')
    const result = await this.communityService.getResources(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('posts/:id/comment')
  async commentPost(@Param('id') id: string, @Body() body: any) {
    console.log('[CommunityController] POST /api/community/posts/:id/comment')
    const result = await this.communityService.commentPost({ ...body, post_id: id })
    return { code: 200, msg: '评论成功', data: result }
  }
}
