import { renderToStaticMarkup } from 'react-dom/server';
import TheCannonAlertEmail, { TheCannonAlertEmailProps } from './TheCannonAlertEmail';

export function renderTheCannonAlertEmail(props: TheCannonAlertEmailProps): string {
  const html = renderToStaticMarkup(<TheCannonAlertEmail {...props} />);
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${html}`;
}

export { TheCannonAlertEmailProps };


