import { IsNotEmpty, IsInt, IsEnum, IsOptional } from 'class-validator';

export enum TeamRole {
  TEAM_ADMIN = 'team_admin',
  MEMBER = 'member',
  OBSERVER = 'observer',
}

export class AddMemberDto {
  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsOptional()
  @IsEnum(TeamRole)
  role?: TeamRole;
}
