import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  HttpCode,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthService } from './local-auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly localAuthService: LocalAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 registration attempts per minute
  @ApiOperation({ summary: 'Register a new user with email and password' })
  @HttpCode(201)
  async register(@Body() dto: RegisterDto) {
    return this.localAuthService.register(dto);
  }

  @Post('login/local')
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 login attempts per minute
  @ApiOperation({ summary: 'Login with email and password' })
  @HttpCode(200)
  async loginLocal(@Body() dto: LoginDto) {
    return this.localAuthService.login(dto);
  }

  @Get('login')
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 login attempts per minute
  @ApiOperation({ summary: 'Initiate Azure AD SSO login' })
  @ApiQuery({ name: 'redirect', required: false, description: 'Redirect URL after login' })
  async login(@Query('redirect') redirect: string, @Res() res: Response) {
    const redirectUri = `${this.config.get('API_URL', 'http://localhost:3001')}/auth/callback`;
    const state = redirect ? Buffer.from(redirect).toString('base64') : undefined;

    const loginUrl = await this.authService.getLoginUrl(redirectUri, state);
    res.redirect(loginUrl);
  }

  @Get('callback')
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 callback attempts per minute
  @ApiOperation({ summary: 'Handle Azure AD OAuth callback' })
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    try {
      const redirectUri = `${this.config.get('API_URL', 'http://localhost:3001')}/auth/callback`;
      const result = await this.authService.handleCallback(code, redirectUri);

      // Decode state to get original redirect URL
      let redirectUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
      if (state) {
        try {
          redirectUrl = Buffer.from(state, 'base64').toString();
        } catch (e) {
          // Invalid state, use default
        }
      }

      // Set JWT in HTTP-only cookie (secure, not accessible to JavaScript)
      res.cookie('authToken', result.accessToken, {
        httpOnly: true,
        secure: this.config.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      // Redirect to frontend without token in URL
      res.redirect(redirectUrl);
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: CurrentUserData) {
    return user;
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and clear auth cookie' })
  async logout(@Res() res: Response) {
    // Clear the auth cookie
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.json({ message: 'Logged out successfully' });
  }

  @Get('dev-token/:userId')
  @ApiOperation({ summary: 'Generate dev token for testing (development only)' })
  async getDevToken(@Param('userId') userId: string) {
    const token = await this.authService.generateDevToken(Number(userId));
    return { token };
  }
}
