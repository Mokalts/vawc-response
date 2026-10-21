import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Start every new screen at the top.
 *
 * A router swaps the page contents without touching the scroll position, so
 * tapping Report Now from halfway down Home opened the report form already
 * scrolled past its own heading. On a phone that reads as a broken page: she
 * cannot see what she just opened, and the thing she is looking for is above
 * her thumb rather than below it.
 *
 * Back and forward are deliberately left alone. Those are the one case where
 * the old position is the right one - returning to My Cases should put her
 * back on the case she was reading, not at the top of the list - and the
 * browser already restores it. `useNavigationType` is what tells the two
 * apart: PUSH and REPLACE are new screens, POP is history.
 *
 * Nothing happens when the URL carries a hash either, since that is a request
 * to land on a particular section rather than at the top.
 */
function ScrollToTop() {
    const { pathname, hash } = useLocation();
    const navigationType = useNavigationType();

    // Layout effect rather than useEffect: this runs before the browser
    // paints, so the new screen is never briefly visible at the old scroll
    // position and then yanked upward.
    useLayoutEffect(() => {
        if (navigationType === 'POP') return;
        if (hash) return;

        // Instant, not smooth. The content underneath has already changed, so
        // animating a scroll through it is motion that describes nothing, and
        // it delays her seeing the screen she asked for.
        try {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        } catch {
            // `behavior: 'instant'` is recent; older engines want the tuple.
            window.scrollTo(0, 0);
        }
    }, [pathname, hash, navigationType]);

    return null;
}

export default ScrollToTop;
