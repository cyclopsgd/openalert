import { IsNotEmpty, IsInt } from 'class-validator';

export class AddDependencyDto {
  @IsNotEmpty()
  @IsInt()
  dependsOnServiceId: number;
}
