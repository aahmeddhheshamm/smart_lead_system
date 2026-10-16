export interface MainModalProps {
    headerTitle: string;
    draggable?: boolean;
    closable?: boolean;
    width?: string;
    modal?: boolean;
    position?: string;
    deleteData?: {
        id: number | string;
        key: string;
        text: string;
        url: string;
    };
    suspendData?: {
        id: number | string;
        key: string;
        text: string;
        url: string;
    };
    approveData?: {
        id: number | string;
        key: string;
        text: string;
        url: string;
    };
}