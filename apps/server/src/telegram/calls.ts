import bigInt from "big-integer";
import { Api, type TelegramClient } from "telegram";
import type { CallDTO } from "@aerogram/shared";

/** Recent call log, via a global search filtered to phone-call service messages. */
export async function listCalls(client: TelegramClient, limit = 40): Promise<CallDTO[]> {
  const res = (await client.invoke(
    new Api.messages.Search({
      peer: new Api.InputPeerEmpty(),
      q: "",
      filter: new Api.InputMessagesFilterPhoneCalls({}),
      minDate: 0,
      maxDate: 0,
      offsetId: 0,
      addOffset: 0,
      limit,
      maxId: 0,
      minId: 0,
      hash: bigInt.zero,
    }),
  )) as any;

  const messages: any[] = res?.messages ?? [];
  const calls: CallDTO[] = [];
  for (const m of messages) {
    const action = m.action;
    if (action?.className !== "MessageActionPhoneCall") continue;
    const reason: string | undefined = action.reason?.className;
    calls.push({
      id: m.id,
      date: m.date ?? 0,
      out: Boolean(m.out),
      video: Boolean(action.video),
      duration: action.duration ?? undefined,
      missed: reason === "PhoneCallDiscardReasonMissed",
    });
  }
  return calls;
}
