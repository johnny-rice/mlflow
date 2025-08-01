import { jsx as _jsx } from "@emotion/react/jsx-runtime";
import { forwardRef } from 'react';
import { Icon } from '../../Icon';
function SvgPlusCircleFillIcon(props) {
    return (_jsx("svg", { xmlns: "http://www.w3.org/2000/svg", width: "1em", height: "1em", fill: "none", viewBox: "0 0 16 16", ...props, children: _jsx("path", { fill: "currentColor", fillRule: "evenodd", d: "M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m-.75-4.5V8.75H4.5v-1.5h2.75V4.5h1.5v2.75h2.75v1.5H8.75v2.75z", clipRule: "evenodd" }) }));
}
const PlusCircleFillIcon = forwardRef((props, forwardedRef) => {
    return _jsx(Icon, { ref: forwardedRef, ...props, component: SvgPlusCircleFillIcon });
});
PlusCircleFillIcon.displayName = 'PlusCircleFillIcon';
export default PlusCircleFillIcon;
//# sourceMappingURL=PlusCircleFillIcon.js.map