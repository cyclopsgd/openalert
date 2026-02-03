import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as msal from '@azure/msal-node';

@Injectable()
export class MsalService {
  private readonly logger = new Logger(MsalService.name);
  private msalClient: msal.ConfidentialClientApplication;

  constructor(private readonly config: ConfigService) {
    const clientId = config.get<string>('AZURE_CLIENT_ID', 'dev-client-id');
    const clientSecret = config.get<string>('AZURE_CLIENT_SECRET', 'dev-client-secret');
    const tenantId = config.get<string>('AZURE_TENANT_ID', 'common');

    // Skip MSAL initialization if credentials are not configured (dev mode)
    if (clientId === 'dev-client-id' && clientSecret === 'dev-client-secret') {
      this.logger.warn(
        'Azure Entra ID credentials not configured. SSO login will not work. Use /auth/dev-token/:userId for testing.',
      );
      return;
    }

    const msalConfig: msal.Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) return;
            switch (level) {
              case msal.LogLevel.Error:
                this.logger.error(message);
                break;
              case msal.LogLevel.Warning:
                this.logger.warn(message);
                break;
              case msal.LogLevel.Info:
                this.logger.log(message);
                break;
              case msal.LogLevel.Verbose:
                this.logger.debug(message);
                break;
            }
          },
          piiLoggingEnabled: false,
          logLevel: msal.LogLevel.Warning,
        },
      },
    };

    this.msalClient = new msal.ConfidentialClientApplication(msalConfig);
  }

  /**
   * Get authorization URL to redirect user to Azure AD login
   */
  async getAuthCodeUrl(redirectUri: string, state?: string): Promise<string> {
    if (!this.msalClient) {
      throw new Error(
        'Azure Entra ID not configured. Use /auth/dev-token/:userId for development.',
      );
    }

    const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
      scopes: ['user.read', 'openid', 'profile', 'email'],
      redirectUri,
      state: state || '',
    };

    try {
      const authUrl = await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
      this.logger.log('Generated auth code URL');
      return authUrl;
    } catch (error) {
      this.logger.error('Error generating auth code URL', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async acquireTokenByCode(code: string, redirectUri: string): Promise<msal.AuthenticationResult> {
    if (!this.msalClient) {
      throw new Error(
        'Azure Entra ID not configured. Use /auth/dev-token/:userId for development.',
      );
    }

    const tokenRequest: msal.AuthorizationCodeRequest = {
      code,
      scopes: ['user.read', 'openid', 'profile', 'email'],
      redirectUri,
    };

    try {
      const response = await this.msalClient.acquireTokenByCode(tokenRequest);
      this.logger.log('Successfully acquired token by code');
      return response;
    } catch (error) {
      this.logger.error('Error acquiring token by code', error);
      throw error;
    }
  }

  /**
   * Validate access token (for API protection)
   */
  async validateToken(accessToken: string): Promise<any> {
    // In production, validate the token signature and claims
    // For now, we'll decode it and trust it (development only)
    try {
      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload;
    } catch (error) {
      this.logger.error('Error validating token', error);
      throw error;
    }
  }
}
