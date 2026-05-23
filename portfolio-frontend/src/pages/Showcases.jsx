import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';
import { useParams, Navigate } from 'react-router-dom';
import { getShowcaseStyle } from '../utils/showcaseStyle';
import { SHOWCASE_STYLE_RENDERERS } from './showcases/renderers';
import './Showcases.css';

const Showcases = () => {
  const { t, resolvePath } = useTranslations();
  const { showcaseIndex } = useParams();

  const showcases = t('common.showcases') || [];
  const index = parseInt(showcaseIndex, 10);

  if (isNaN(index) || index < 0 || index >= showcases.length) {
    return <Navigate to="/" replace />;
  }

  const showcase = showcases[index];
  const showcaseStyle = getShowcaseStyle(showcase);
  const ShowcaseRenderer = SHOWCASE_STYLE_RENDERERS[showcaseStyle] || SHOWCASE_STYLE_RENDERERS.carousel;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [showcaseIndex]);

  useEffect(() => {
    document.title = t('common.baseTitle');
  }, [t]);

  return (
    <ShowcaseRenderer
      showcase={showcase}
      resolvePath={resolvePath}
      showcaseIndex={showcaseIndex}
    />
  );
};

export default Showcases;
