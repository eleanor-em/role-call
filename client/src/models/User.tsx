export interface User {
    token: string,
    username: string
}

export function stripUserTag(username: string): string {
    const parts =  username.split('#');
    parts.pop();
    return parts.join('#');
}