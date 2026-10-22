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

export function findMemberById(id: number): Member | undefined {
  return members.find((member) => member.id === id);
}

export interface UpdateMemberInput {
  name?: string;
  email?: string;
}

export function updateMember(id: number, input: UpdateMemberInput): Member | undefined {
  const member = findMemberById(id);

  if (!member) {
    return undefined;
  }

  if (typeof input.name === 'string' && input.name.trim()) {
    member.name = input.name.trim();
  }

  if (typeof input.email === 'string' && input.email.trim()) {
    member.email = input.email.trim().toLowerCase();
  }

  return member;
}

export function deleteMember(id: number): boolean {
  const index = members.findIndex((member) => member.id === id);

  if (index === -1) {
    return false;
  }

  members.splice(index, 1);

  return true;
}

export function listMembers(): readonly Member[] {
  return members;
}

export function resetMembers(): void {
  members.length = 0;
  nextId = 1;
}
