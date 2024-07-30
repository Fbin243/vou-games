
/**
 * Fades an HTML element in or out using the Animation API.
 * @param {HTMLElement} element - an HTML element.
 * @param {"in" | "out"} fadeDirection - the direction to fade, either "in" or "out".
 * @param {KeyframeAnimationOptions} options - Any additional CSS animations options to set. The
 * default duration is 500ms. The default easing depends on the fade direction.
 * @return {Animation}
 */
export default function fade(element, fadeDirection = "in", options) {
  const isFadeIn = fadeDirection === "in";

  const keyframes = [{ opacity: 1 }, { opacity: 0 }];
  if (isFadeIn) keyframes.reverse();

  const mergedOptions = {
    duration: 500,
    easing: isFadeIn ? "ease-in" : "ease-out",
    ...options,
  };

  const animation = element.animate(keyframes, mergedOptions);
  return animation;
}
