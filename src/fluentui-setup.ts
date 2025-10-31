import {
  provideFluentDesignSystem,
  fluentButton,
  fluentCard,
  fluentAnchor,
  fluentBadge,
  fluentTextField,
  fluentTextArea,
  fluentProgressRing,
  fluentDivider,
  fluentToolbar,
} from '@fluentui/web-components';
import { webLightTheme } from '@fluentui/tokens';

provideFluentDesignSystem()
  .register(
    fluentButton(),
    fluentCard(),
    fluentAnchor(),
    fluentBadge(),
    fluentTextField(),
    fluentTextArea(),
    fluentProgressRing(),
    fluentDivider(),
    fluentToolbar()
  );

if (typeof document !== 'undefined') {
  const root = document.documentElement;

  Object.entries(webLightTheme).forEach(([key, value]) => {
    if (typeof value === 'string') {
      root.style.setProperty(`--${key}`, value);
    }
  });
}
