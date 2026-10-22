export interface Member {
  id: number;
  name: string;
  email: string;
}

export interface CreateMemberInput {
  name: string;
  email: string;
}

const members: Member[] = [];
let nextId = 1;

export function createMember(input: CreateMemberInput): Member {
  const member: Member = {
    id: nextId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
  };

  nextId += 1;
  members.push(member);

  return member;
}

export function findMemberByEmail(email: string): Member | undefined {
  const normalised = email.trim().toLowerCase();
  return members.find((member) => member.email === normalised);
}

export function listMembers(): readonly Member[] {
  return members;
}

export function resetMembers(): void {
  members.length = 0;
  nextId = 1;
}
