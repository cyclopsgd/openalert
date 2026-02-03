import { IsNotEmpty, IsEnum } from 'class-validator';
import { TeamRole } from './add-member.dto';

export class UpdateMemberRoleDto {
  @IsNotEmpty()
  @IsEnum(TeamRole)
  role: TeamRole;
}
