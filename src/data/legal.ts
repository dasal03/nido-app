import type { Language } from '@/providers/Preferences';

/**
 * Privacy policy and terms of use shown in the app. This is a starting template written for
 * Nido's actual behavior: have it reviewed by a lawyer for each country where the app is offered.
 */
export type LegalDoc = 'privacy' | 'terms';

interface LegalText {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}

const UPDATED = '2026-09-26';

export const LEGAL: Record<Language, Record<LegalDoc, LegalText>> = {
  es: {
    privacy: {
      title: 'Política de privacidad',
      updated: UPDATED,
      sections: [
        {
          heading: 'Qué datos guardamos',
          body: 'Tu nombre, usuario, correo, teléfono, país y foto de perfil; y, de forma privada, tu fecha de nacimiento, género y documento de identidad. También los nidos, metas, aportes, retiros, reacciones y comentarios que registras.',
        },
        {
          heading: 'Para qué los usamos',
          body: 'Para crear tu cuenta, verificar que eres mayor de edad y que cada documento se registra una sola vez, mostrar los ahorros compartidos a los integrantes de cada nido y enviarte recordatorios que tú activas. No vendemos tus datos ni los usamos para publicidad.',
        },
        {
          heading: 'Quién los ve',
          body: 'Los integrantes de un nido ven tu nombre, usuario, foto y los movimientos de ese nido. Tu fecha de nacimiento, género y documento solo los ves tú. Los datos se alojan en Supabase, nuestro proveedor de base de datos.',
        },
        {
          heading: 'Seguridad',
          body: 'Las contraseñas se guardan cifradas por el proveedor de autenticación. Si activas el inicio con huella o Face ID, la contraseña queda en el almacenamiento seguro de tu teléfono y nunca sale de él.',
        },
        {
          heading: 'Tus derechos',
          body: 'Puedes consultar y corregir tus datos en Ajustes, exportar tus movimientos y eliminar tu cuenta en Ajustes → Eliminar cuenta. Al eliminarla borramos tus datos personales; los movimientos que hiciste en nidos compartidos se conservan de forma anónima para que el historial de los demás siga siendo correcto.',
        },
        {
          heading: 'Contacto',
          body: 'Si tienes preguntas sobre tus datos, escríbenos desde el correo con el que te registraste.',
        },
      ],
    },
    terms: {
      title: 'Términos de uso',
      updated: UPDATED,
      sections: [
        {
          heading: 'Qué es Nido',
          body: 'Nido es una herramienta para registrar y organizar ahorros en pareja o en familia. Nido no guarda ni mueve dinero real: los montos son registros que ustedes llevan de sus ahorros.',
        },
        {
          heading: 'Tu cuenta',
          body: 'Debes tener al menos 17 años y dar información verdadera. Eres responsable de mantener tu contraseña segura y de lo que se registre desde tu cuenta.',
        },
        {
          heading: 'Nidos compartidos',
          body: 'Los retiros, la disolución de un nido y la salida de un grupo familiar requieren la aprobación de todos los integrantes. Al disolver o salir, el saldo registrado se reparte en proporción a lo que cada uno aportó.',
        },
        {
          heading: 'Uso aceptable',
          body: 'No uses Nido para actividades ilegales, para suplantar a otras personas ni para acosar a otros integrantes. Podemos suspender cuentas que incumplan estos términos.',
        },
        {
          heading: 'Responsabilidad',
          body: 'Nido se ofrece "tal cual". No somos una entidad financiera ni damos asesoría financiera. Los acuerdos de dinero entre integrantes son responsabilidad de ellos.',
        },
        {
          heading: 'Cambios',
          body: 'Podemos actualizar estos términos; te avisaremos en la app cuando haya cambios importantes.',
        },
      ],
    },
  },
  en: {
    privacy: {
      title: 'Privacy policy',
      updated: UPDATED,
      sections: [
        {
          heading: 'What we store',
          body: 'Your name, username, email, phone, country and profile photo; and, privately, your birthday, gender and ID document. Also the nests, goals, contributions, withdrawals, reactions and comments you record.',
        },
        {
          heading: 'Why we use it',
          body: "To create your account, check that you're of age and that each ID is registered only once, show shared savings to the members of each nest, and send the reminders you turn on. We don't sell your data or use it for advertising.",
        },
        {
          heading: 'Who sees it',
          body: "Members of a nest see your name, username, photo and that nest's movements. Only you see your birthday, gender and ID. Data is hosted by Supabase, our database provider.",
        },
        {
          heading: 'Security',
          body: "Passwords are stored hashed by the authentication provider. If you turn on fingerprint or Face ID sign-in, your password stays in your phone's secure storage and never leaves it.",
        },
        {
          heading: 'Your rights',
          body: "You can view and correct your data in Settings, export your movements, and delete your account in Settings → Delete account. Deleting it erases your personal data; your movements in shared nests are kept anonymously so the other members' history stays correct.",
        },
        {
          heading: 'Contact',
          body: 'For questions about your data, write to us from the email you signed up with.',
        },
      ],
    },
    terms: {
      title: 'Terms of use',
      updated: UPDATED,
      sections: [
        {
          heading: 'What Nido is',
          body: "Nido is a tool to record and organize savings as a couple or a family. Nido doesn't hold or move real money: amounts are records you keep of your savings.",
        },
        {
          heading: 'Your account',
          body: 'You must be at least 17 and give truthful information. You are responsible for keeping your password safe and for what is recorded from your account.',
        },
        {
          heading: 'Shared nests',
          body: 'Withdrawals, dissolving a nest and leaving a family group need the approval of every member. When dissolving or leaving, the recorded balance is split in proportion to what each person contributed.',
        },
        {
          heading: 'Acceptable use',
          body: "Don't use Nido for illegal activities, to impersonate others or to harass other members. We may suspend accounts that break these terms.",
        },
        {
          heading: 'Liability',
          body: 'Nido is provided "as is". We are not a financial institution and do not give financial advice. Money agreements between members are their own responsibility.',
        },
        {
          heading: 'Changes',
          body: "We may update these terms; we'll let you know in the app when there are important changes.",
        },
      ],
    },
  },
};
