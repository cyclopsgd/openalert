import { IsOptional, IsString, IsInt, IsEnum, IsArray, ArrayUnique } from 'class-validator';
import { ServiceStatus } from './create-service.dto';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  teamId?: number;

  @IsOptional()
  @IsInt()
  escalationPolicyId?: number;

  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  dependencyIds?: number[];
}
