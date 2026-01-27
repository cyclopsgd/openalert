import { Controller, Get, Query, Res, UseGuards, HttpCode, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('login')
  @ApiOperation({ summary: 'Initiate Azure AD login' })
  @ApiQuery({ name: 'redirect', required: false, description: 'Redirect URL after login' })
  async login(@Query('redirect') redirect: string, @Res() res: Response) {
    const redirectUri = `${this.config.get('API_URL', 'http://localhost:3001')}/auth/callback`;
    const state = redirect ? Buffer.from(redirect).toString('base64') : undefined;

    const loginUrl = await this.authService.getLoginUrl(redirectUri, state);
    res.redirect(loginUrl);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle Azure AD OAuth callback' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
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

      // In production, redirect to frontend with token in URL fragment
      // Frontend will extract token and store it
      res.redirect(`${redirectUrl}?token=${result.accessToken}`);
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
  @ApiOperation({ summary: 'Logout (client-side token removal)' })
  async logout() {
    return { message: 'Logged out successfully' };
  }

  @Get('dev-token/:userId')
  @ApiOperation({ summary: 'Generate dev token for testing (development only)' })
  async getDevToken(@Param('userId') userId: string) {
    const token = await this.authService.generateDevToken(Number(userId));
    return { token };
  }
}
