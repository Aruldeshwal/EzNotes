'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { ActionResult } from '@/lib/types';
import { UserSettings, AccessType, Theme } from '@prisma/client';

export interface UpdateUserSettingsInput {
  defaultTheme?: Theme;
  defaultAccess?: AccessType;
  defaultExpiryHours?: number | null;
}

/**
 * Server Action: Updates or creates user settings for the authenticated user.
 */
export async function updateUserSettings(
  input: UpdateUserSettingsInput
): Promise<ActionResult<UserSettings>> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const settings = await prisma.userSettings.upsert({
      where: { clerkUserId: userId },
      update: {
        ...(input.defaultTheme !== undefined && { defaultTheme: input.defaultTheme }),
        ...(input.defaultAccess !== undefined && { defaultAccess: input.defaultAccess }),
        ...(input.defaultExpiryHours !== undefined && {
          defaultExpiryHours: input.defaultExpiryHours,
        }),
      },
      create: {
        clerkUserId: userId,
        defaultTheme: input.defaultTheme || Theme.SYSTEM,
        defaultAccess: input.defaultAccess || AccessType.PUBLIC,
        defaultExpiryHours: input.defaultExpiryHours ?? null,
      },
    });

    return { success: true, data: settings };
  } catch (err) {
    console.error('Failed to update user settings:', err);
    return { success: false, error: 'Failed to update settings.', code: 'DB_ERROR' };
  }
}

/**
 * Server Action: Retrieves user settings for the authenticated user.
 */
export async function getUserSettings(): Promise<ActionResult<UserSettings | null>> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const settings = await prisma.userSettings.findUnique({
      where: { clerkUserId: userId },
    });
    return { success: true, data: settings };
  } catch (err) {
    console.error('Failed to get user settings:', err);
    return { success: false, error: 'Failed to retrieve settings.', code: 'DB_ERROR' };
  }
}
