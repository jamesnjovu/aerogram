import bigInt from "big-integer";
import { Api, type TelegramClient } from "telegram";
import { CustomFile } from "telegram/client/uploads";
import type { Birthday, ProfileDTO } from "@aerogram/shared";

/**
 * Self-profile operations for the settings page: read the full profile, edit
 * name/bio/username/birthday, and change or remove the profile photo.
 * All operate on the logged-in account via Api.InputUserSelf.
 */

/** Read the full self profile (name, bio, username, phone, birthday, has-photo). */
export async function getProfile(client: TelegramClient): Promise<ProfileDTO> {
  const full = await client.invoke(
    new Api.users.GetFullUser({ id: new Api.InputUserSelf() }),
  );
  const fullUser = full.fullUser as any;
  const self = (full.users as any[]).find((u) => u.className === "User") as any;
  const bday = fullUser?.birthday;

  return {
    id: String(self?.id ?? ""),
    firstName: self?.firstName ?? "",
    lastName: self?.lastName ?? undefined,
    username: self?.username ?? undefined,
    phone: self?.phone ?? undefined,
    bio: fullUser?.about ?? undefined,
    birthday: bday
      ? { day: bday.day, month: bday.month, year: bday.year ?? undefined }
      : undefined,
    hasPhoto: Boolean(self?.photo && self.photo.className !== "UserProfilePhotoEmpty"),
  };
}

/** Update first/last name and/or bio. Undefined fields are left unchanged. */
export async function updateProfile(
  client: TelegramClient,
  data: { firstName?: string; lastName?: string; bio?: string },
): Promise<void> {
  await client.invoke(
    new Api.account.UpdateProfile({
      firstName: data.firstName,
      lastName: data.lastName,
      about: data.bio,
    }),
  );
}

/** Set (or clear, with an empty string) the public username. */
export async function updateUsername(client: TelegramClient, username: string): Promise<void> {
  await client.invoke(new Api.account.UpdateUsername({ username }));
}

/** Set or clear the birthday. Pass null to clear it. */
export async function updateBirthday(
  client: TelegramClient,
  birthday: Birthday | null,
): Promise<void> {
  await client.invoke(
    new Api.account.UpdateBirthday({
      birthday: birthday
        ? new Api.Birthday({ day: birthday.day, month: birthday.month, year: birthday.year })
        : undefined,
    }),
  );
}

/** Upload a new profile photo from raw bytes. */
export async function setProfilePhoto(
  client: TelegramClient,
  buffer: Buffer,
  filename: string,
): Promise<void> {
  const file = new CustomFile(filename || "avatar.jpg", buffer.length, "", buffer);
  const inputFile = await client.uploadFile({ file, workers: 1 });
  await client.invoke(new Api.photos.UploadProfilePhoto({ file: inputFile }));
}

/** Remove the current profile photo (best-effort). */
export async function deleteProfilePhoto(client: TelegramClient): Promise<void> {
  const res = await client.invoke(
    new Api.photos.GetUserPhotos({
      userId: new Api.InputUserSelf(),
      offset: 0,
      maxId: bigInt.zero,
      limit: 1,
    }),
  );
  const photo = (res.photos as any[])[0];
  if (!photo) return;
  await client.invoke(
    new Api.photos.DeletePhotos({
      id: [
        new Api.InputPhoto({
          id: photo.id,
          accessHash: photo.accessHash,
          fileReference: photo.fileReference,
        }),
      ],
    }),
  );
}

/** Download the logged-in user's own profile photo bytes (small size), or null. */
export async function downloadSelfPhoto(client: TelegramClient): Promise<Buffer | null> {
  const data: unknown = await client.downloadProfilePhoto(new Api.InputUserSelf(), {
    isBig: false,
  });
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data.length ? data : null;
  if (data instanceof Uint8Array) return data.length ? Buffer.from(data) : null;
  return null;
}
