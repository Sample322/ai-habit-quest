import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { TasksService } from './tasks.service';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('today')
  today(@CurrentUser() me: AuthenticatedUser) {
    return this.tasks.listToday(me.id);
  }

  @Post(':id/toggle')
  toggle(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.tasks.toggle(me.id, id);
  }
}
