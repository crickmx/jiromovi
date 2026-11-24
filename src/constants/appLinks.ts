export const APP_LINKS = {
  ANDROID_PLAY_STORE: 'https://play.google.com/store/apps/details?id=com.wnapp.id1739907855051&pcampaignid=web_share&pli=1',
  IOS_APP_STORE: '',
  COMPANY_NAME: 'Movi Digital',
  APP_NAME: 'Movi Digital',
  SUPPORT_EMAIL: 'soporte@movidigital.com',
  SUPPORT_PHONE: '+52 1 55 1234 5678',
  WEBSITE: 'https://movidigital.com'
} as const;

export const ANALYTICS_EVENTS = {
  INSTALL_PROMPT_SHOWN: 'install_prompt_shown',
  INSTALL_BUTTON_CLICKED: 'install_button_clicked',
  ANDROID_APP_LINK_CLICKED: 'android_app_link_clicked',
  PWA_INSTALLED: 'pwa_installed',
  PWA_INSTALL_DISMISSED: 'pwa_install_dismissed'
} as const;

export const STORAGE_KEYS = {
  INSTALL_PROMPT_DISMISSED: 'install_prompt_dismissed',
  INSTALL_PROMPT_COUNT: 'install_prompt_count',
  LAST_PROMPT_DATE: 'last_prompt_date'
} as const;
