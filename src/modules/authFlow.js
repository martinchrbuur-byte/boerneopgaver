import { createAuthView } from '../ui/mainView.js';

export function authErrorMessage(error, fallback = 'Kunne ikke gennemføre login.') {
  if (!error || typeof error !== 'object') return fallback;
  return typeof error.message === 'string' && error.message.trim() ? error.message : fallback;
}

export function resolveInitialAuthPage(location = globalThis.window?.location) {
  return location?.hash === '#reset-password' ? 'reset-password' : 'welcome';
}

export async function startAuthFlow({
  root,
  initialPage = resolveInitialAuthPage(),
  message = '',
  init,
  signUpWithEmail,
  signInWithEmail,
  sendPasswordResetEmail,
  updateCurrentUserPassword
}) {
  const readField = (formData, key, trim = true) => {
    const value = String(formData.get(key) || '');
    return trim ? value.trim() : value;
  };

  const render = (page, feedbackMessage = '') => {
    const authView = createAuthView(root, { page, message: feedbackMessage });
    const bindSubmit = (form, handler) => {
      form?.addEventListener('submit', async event => {
        event.preventDefault();
        await handler(new FormData(form));
      });
    };

    authView.navButtons.forEach(button => {
      button.addEventListener('click', () => render(button.getAttribute('data-auth-nav') || 'welcome'));
    });

    bindSubmit(authView.signupForm, async formData => {
      const email = readField(formData, 'email');
      const password = readField(formData, 'password', false);
      if (password !== readField(formData, 'passwordConfirm', false)) {
        render('signup', 'Adgangskoderne matcher ikke.');
        return;
      }
      try {
        const result = await signUpWithEmail(email, password);
        if (result?.session?.user?.id) {
          window.location.hash = '';
          await init();
        } else {
          render('login', 'Konto oprettet. Tjek email og log derefter ind.');
        }
      } catch (error) {
        render('signup', authErrorMessage(error, 'Kunne ikke oprette konto.'));
      }
    });

    bindSubmit(authView.loginForm, async formData => {
      try {
        await signInWithEmail(readField(formData, 'email'), readField(formData, 'password', false));
        window.location.hash = '';
        await init();
      } catch (error) {
        render('login', authErrorMessage(error, 'Login mislykkedes.'));
      }
    });

    bindSubmit(authView.forgotForm, async formData => {
      try {
        await sendPasswordResetEmail(readField(formData, 'email'));
        render('login', 'Nulstillingslink sendt. Tjek din email.');
      } catch (error) {
        render('forgot-password', authErrorMessage(error, 'Kunne ikke sende nulstillingslink.'));
      }
    });

    bindSubmit(authView.resetForm, async formData => {
      const password = readField(formData, 'password', false);
      if (password !== readField(formData, 'passwordConfirm', false)) {
        render('reset-password', 'Adgangskoderne matcher ikke.');
        return;
      }
      try {
        await updateCurrentUserPassword(password);
        window.location.hash = '';
        render('login', 'Adgangskode opdateret. Log ind igen.');
      } catch (error) {
        render('reset-password', authErrorMessage(error, 'Kunne ikke opdatere adgangskode.'));
      }
    });
  };

  render(initialPage, message);
}
