import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./store";

// Hooks tipados: use estes no lugar de useDispatch/useSelector crus.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
