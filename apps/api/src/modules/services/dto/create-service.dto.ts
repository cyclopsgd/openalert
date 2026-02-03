import { IsNotEmpty, IsString, IsOptional, IsInt, IsEnum, IsArray, ArrayUnique } from 'class-validator';

export enum ServiceStatus {
  OPERATIONAL = 'operational',
  DEGRADED = 'degraded',
  OUTAGE = 'outage',
  MAINTENANCE = 'maintenance',
}

export class CreateServiceDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsInt()
  teamId: number;

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
