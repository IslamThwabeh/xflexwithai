import { Fragment } from 'react';
import { Link } from 'wouter';
import { HOME_SCREEN_GUIDE_PATH, HOME_SCREEN_GUIDE_URL } from '@shared/studentWelcome';

/** Keep chat as plain text, making only the known academy guide actionable. */
export default function SupportMessageContent({ content }: { content: string }) {
  return content.split(HOME_SCREEN_GUIDE_URL).map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <Link href={HOME_SCREEN_GUIDE_PATH} className="underline underline-offset-2" dir="ltr">{HOME_SCREEN_GUIDE_URL}</Link>}
      {part}
    </Fragment>
  ));
}
