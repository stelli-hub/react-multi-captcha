import { useEffect, useRef } from "react";

/**
 * Returns a ref whose `.current` always points at the most recent value
 * passed in. Useful for callbacks that should be readable from long-lived
 * effects without re-running the effect each time the callback identity
 * changes.
 */
export function useLatestRef<T>(value: T) {
	const ref = useRef(value);
	useEffect(() => {
		ref.current = value;
	});
	return ref;
}
