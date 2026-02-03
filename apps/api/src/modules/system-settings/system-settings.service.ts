import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { systemSettings, SystemSetting } from '../../database/schema';

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all system settings
   */
  async getAll(): Promise<SystemSetting[]> {
    return this.db.db.select().from(systemSettings).orderBy(systemSettings.key);
  }

  /**
   * Get a single setting by key
   */
  async getByKey(key: string): Promise<SystemSetting | undefined> {
    return this.db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, key),
    });
  }

  /**
   * Get setting value by key, or return default
   */
  async getValue<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    const setting = await this.getByKey(key);
    return setting ? (setting.value as T) : defaultValue;
  }

  /**
   * Set a setting value
   */
  async set(key: string, value: any, description?: string): Promise<SystemSetting> {
    const existing = await this.getByKey(key);

    if (existing) {
      const [updated] = await this.db.db
        .update(systemSettings)
        .set({
          value,
          description: description || existing.description,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, existing.id))
        .returning();

      this.logger.log(`Updated setting: ${key}`);
      return updated;
    }

    const [created] = await this.db.db
      .insert(systemSettings)
      .values({
        key,
        value,
        description,
      })
      .returning();

    this.logger.log(`Created setting: ${key}`);
    return created;
  }

  /**
   * Delete a setting
   */
  async delete(key: string): Promise<void> {
    const existing = await this.getByKey(key);

    if (!existing) {
      throw new NotFoundException(`Setting ${key} not found`);
    }

    await this.db.db.delete(systemSettings).where(eq(systemSettings.id, existing.id));
    this.logger.log(`Deleted setting: ${key}`);
  }

  /**
   * Get SSO configuration
   */
  async getSSOConfig() {
    const [tenantId, clientId, clientSecret, ssoEnabled, registrationEnabled] = await Promise.all([
      this.getValue('sso.azure_ad.tenant_id'),
      this.getValue('sso.azure_ad.client_id'),
      this.getValue('sso.azure_ad.client_secret'),
      this.getValue('sso.enabled', false),
      this.getValue('sso.registration_enabled', true),
    ]);

    return {
      tenantId,
      clientId,
      clientSecret: clientSecret ? '********' : null, // Mask the secret
      ssoEnabled,
      registrationEnabled,
    };
  }

  /**
   * Update SSO configuration
   */
  async updateSSOConfig(config: {
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    ssoEnabled?: boolean;
    registrationEnabled?: boolean;
  }) {
    const updates: Promise<SystemSetting>[] = [];

    if (config.tenantId !== undefined) {
      updates.push(this.set('sso.azure_ad.tenant_id', config.tenantId, 'Azure AD Tenant ID'));
    }
    if (config.clientId !== undefined) {
      updates.push(this.set('sso.azure_ad.client_id', config.clientId, 'Azure AD Client ID'));
    }
    if (config.clientSecret !== undefined && config.clientSecret !== '********') {
      updates.push(
        this.set('sso.azure_ad.client_secret', config.clientSecret, 'Azure AD Client Secret'),
      );
    }
    if (config.ssoEnabled !== undefined) {
      updates.push(this.set('sso.enabled', config.ssoEnabled, 'SSO Enforcement Enabled'));
    }
    if (config.registrationEnabled !== undefined) {
      updates.push(
        this.set(
          'sso.registration_enabled',
          config.registrationEnabled,
          'User Registration Enabled',
        ),
      );
    }

    await Promise.all(updates);
    this.logger.log('Updated SSO configuration');

    return this.getSSOConfig();
  }

  /**
   * Get general settings configuration
   */
  async getGeneralSettings() {
    const [
      organizationName,
      organizationLogoUrl,
      defaultTimezone,
      dateTimeFormat,
      language,
      companyWebsite,
      supportEmail,
    ] = await Promise.all([
      this.getValue('general.organization_name', 'OpenAlert'),
      this.getValue('general.organization_logo_url'),
      this.getValue('general.default_timezone', 'UTC'),
      this.getValue('general.datetime_format', 'YYYY-MM-DD HH:mm:ss'),
      this.getValue('general.language', 'en'),
      this.getValue('general.company_website'),
      this.getValue('general.support_email'),
    ]);

    return {
      organizationName,
      organizationLogoUrl,
      defaultTimezone,
      dateTimeFormat,
      language,
      companyWebsite,
      supportEmail,
    };
  }

  /**
   * Update general settings
   */
  async updateGeneralSettings(config: {
    organizationName?: string;
    organizationLogoUrl?: string;
    defaultTimezone?: string;
    dateTimeFormat?: string;
    language?: string;
    companyWebsite?: string;
    supportEmail?: string;
  }) {
    const updates: Promise<SystemSetting>[] = [];

    if (config.organizationName !== undefined) {
      updates.push(
        this.set('general.organization_name', config.organizationName, 'Organization Name'),
      );
    }
    if (config.organizationLogoUrl !== undefined) {
      updates.push(
        this.set(
          'general.organization_logo_url',
          config.organizationLogoUrl,
          'Organization Logo URL',
        ),
      );
    }
    if (config.defaultTimezone !== undefined) {
      updates.push(
        this.set('general.default_timezone', config.defaultTimezone, 'Default Timezone'),
      );
    }
    if (config.dateTimeFormat !== undefined) {
      updates.push(this.set('general.datetime_format', config.dateTimeFormat, 'Date/Time Format'));
    }
    if (config.language !== undefined) {
      updates.push(this.set('general.language', config.language, 'Language'));
    }
    if (config.companyWebsite !== undefined) {
      updates.push(this.set('general.company_website', config.companyWebsite, 'Company Website'));
    }
    if (config.supportEmail !== undefined) {
      updates.push(this.set('general.support_email', config.supportEmail, 'Support Email'));
    }

    await Promise.all(updates);
    this.logger.log('Updated general settings');

    return this.getGeneralSettings();
  }
}
