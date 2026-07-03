import { IsString, IsOptional, IsEnum, MaxLength, IsNumber, IsBoolean } from 'class-validator'

export class CreateProjectDto {
  @IsString()
  @MaxLength(255)
  title: string

  @IsString()
  description: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cover_image?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  industry?: string

  @IsOptional()
  @IsString()
  stage?: string

  @IsOptional()
  amount_min?: string

  @IsOptional()
  amount_max?: string

  @IsString()
  owner_id: string

  @IsOptional()
  tags?: any
}

export class CreateEventDto {
  @IsString()
  @MaxLength(255)
  title: string

  @IsString()
  description: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cover_image?: string

  @IsString()
  event_type: string

  @IsString()
  start_time: string

  @IsString()
  end_time: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string

  @IsOptional()
  max_participants?: number

  @IsOptional()
  fee?: string

  @IsOptional()
  @IsString()
  organizer_id?: string

  @IsOptional()
  @IsString()
  org_id?: string
}

export class RegisterEventDto {
  @IsString()
  member_id: string
}
