import { User, EmailAuthProvider, linkWithCredential, updatePassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const FIREBASE_CONSOLE_AUTH_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

/**
 * Normalizes a display name into a clean username:
 * - Converts to lowercase
 * - Strips diacritics / accents (e.g., 'João' -> 'joao')
 * - Replaces non-alphanumeric chars with '.'
 * - Trims consecutive dots and leading/trailing dots
 */
export function normalizeUsername(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
}

/**
 * Generates a unique username avoiding conflicts with existing names.
 */
export function generateUniqueUsername(baseName: string, existingUsernames: string[] = []): string {
  const normalized = normalizeUsername(baseName) || 'usuario';
  const existingSet = new Set(existingUsernames.map(u => u.toLowerCase()));
  if (!existingSet.has(normalized)) {
    return normalized;
  }
  let counter = 2;
  while (existingSet.has(`${normalized}${counter}`)) {
    counter++;
  }
  return `${normalized}${counter}`;
}

/**
 * Returns the internal email used for Firebase Auth.
 * If the input already contains '@', it is treated as a full email (e.g. admin email).
 * Otherwise, it formats it as username@taxi.app.
 */
export function getInternalEmail(nameOrUsername: string): string {
  const trimmed = nameOrUsername.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  const normalized = normalizeUsername(trimmed);
  return `${normalized}@taxi.app`;
}

/**
 * Checks if an error code represents an authentication collision/conflict.
 */
export function isAuthConflictError(errorCode: string): boolean {
  return [
    'auth/account-exists-with-different-credential',
    'auth/credential-already-in-use',
    'auth/email-already-in-use'
  ].includes(errorCode);
}

/**
 * Sets or updates the password for a user.
 * If the user logged in with Google/OAuth and has no password provider,
 * it safely links the EmailAuthProvider so the user can log in with EITHER Google OR Email/Password.
 */
export async function setOrUpdateUserPassword(
  user: User, 
  newPassword: string
): Promise<{ success: boolean; message: string; linked: boolean }> {
  if (!user) {
    throw new Error('Usuário não autenticado.');
  }

  const hasPasswordProvider = user.providerData.some(p => p.providerId === 'password');

  if (hasPasswordProvider) {
    await updatePassword(user, newPassword);
    return { 
      success: true, 
      linked: false, 
      message: 'Senha alterada com sucesso!' 
    };
  } else if (user.email) {
    const credential = EmailAuthProvider.credential(user.email, newPassword);
    try {
      await linkWithCredential(user, credential);
      return { 
        success: true, 
        linked: true, 
        message: 'Senha vinculada com sucesso! Agora você pode entrar com seu e-mail e senha, ou continuar usando o Google.' 
      };
    } catch (linkError: any) {
      if (linkError.code === 'auth/provider-already-linked') {
        await updatePassword(user, newPassword);
        return { success: true, linked: false, message: 'Senha atualizada com sucesso!' };
      }
      throw linkError;
    }
  } else {
    await updatePassword(user, newPassword);
    return { success: true, linked: false, message: 'Senha atualizada com sucesso!' };
  }
}

/**
 * Maps Firebase Auth error codes to user-friendly Portuguese messages.
 */
export function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/operation-not-allowed':
      return 'O provedor de autenticação "E-mail/senha" está desativado no Firebase Console.';
    case 'auth/account-exists-with-different-credential':
      return 'Conflito de autenticação: Já existe uma conta com este e-mail usando outro método de login (como Google ou Senha). Por favor, entre pelo método original para unificar sua conta.';
    case 'auth/credential-already-in-use':
      return 'Conflito de autenticação: Esta credencial já está associada a outra conta ativa no sistema.';
    case 'auth/email-already-in-use':
      return 'Conflito de autenticação: Este nome de usuário ou e-mail já está em uso por outra conta. Escolha outro nome de usuário.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Deve ter no mínimo 6 caracteres.';
    case 'auth/invalid-email':
      return 'Formato de usuário ou e-mail inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Usuário ou senha incorretos. Verifique suas credenciais.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas consecutivas. Aguarde alguns instantes e tente novamente.';
    case 'auth/requires-recent-login':
      return 'Esta operação requer um login recente. Por favor, saia e entre novamente antes de alterar a senha.';
    case 'auth/network-request-failed':
      return 'Falha de conexão. Verifique sua internet.';
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação foi fechada antes de concluir o login.';
    default:
      return 'Ocorreu um erro de autenticação. Tente novamente.';
  }
}
