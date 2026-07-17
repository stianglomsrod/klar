"use server";

export type SubstituteAccount = {
  id: string;
  email: string;
  full_name: string | null;
  is_substitute: boolean;
};

/** @deprecated Substitute accounts from the 2.x data model are not part of v3. */
export async function getSubstituteAccounts(): Promise<SubstituteAccount[]> {
  return [];
}
