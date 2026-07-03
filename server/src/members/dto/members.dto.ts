import { IsString, IsOptional, IsEnum, IsPhoneNumber, MaxLength, IsArray } from 'class-validator'

export class RegisterDto {
  @IsString()
  @MaxLength(32)
  phone: string

  @IsString()
  @MaxLength(255)
  password: string

  @IsString()
  @MaxLength(128)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  birthday?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company_name?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  company_position?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  industry_primary?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  industry_secondary?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  company_scale?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  company_address?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  company_website?: string

  @IsOptional()
  @IsString()
  business_description?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  core_advantage?: string

  @IsOptional()
  @IsString()
  resources_supply?: string

  @IsOptional()
  @IsString()
  resources_demand?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  wechat_id?: string

  @IsOptional()
  @IsString()
  bio?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  join_source?: string

  @IsOptional()
  @IsString()
  referrer_id?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  intended_org_id?: string
}

export class LoginDto {
  @IsString()
  phone: string

  @IsString()
  password: string
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company_name?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  company_position?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  industry_primary?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  industry_secondary?: string

  @IsOptional()
  @IsString()
  business_description?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  core_advantage?: string

  @IsOptional()
  @IsString()
  resources_supply?: string

  @IsOptional()
  @IsString()
  resources_demand?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string

  @IsOptional()
  @IsString()
  bio?: string
}

export class UpdateTagsDto {
  @IsArray()
  tags: Array<{ tag_type: string; tag_value: string }>
}
