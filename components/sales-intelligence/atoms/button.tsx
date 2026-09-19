import { Button as HostButton, type ButtonProps } from '@/components/ui/button';
export function Button({className,...props}:ButtonProps) {
 return <HostButton variant="outline" className={`si-btn si-btn--secondary si-btn--md ${className ?? ''}`} {...props}/>;
}
