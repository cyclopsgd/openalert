import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthService } from './local-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MsalService } from './msal.service';
import { UsersModule } from '../users/users.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => SystemSettingsModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalAuthService, JwtStrategy, MsalService],
  exports: [AuthService, LocalAuthService, JwtModule, MsalService],
})
export class AuthModule {}
