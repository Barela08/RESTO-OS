import React from 'react';
import { cn } from '../../utils/cn';
import { TableStatus, OrderStatus, KitchenTicketStatus, PaymentStatus } from '../../types';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'orange' | 'outline';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-brand-purple border-purple-200',
    orange: 'bg-orange-50 text-brand-orange border-orange-200',
    outline: 'border border-slate-300 text-slate-700 bg-transparent',
  };

  const dots = {
    default: 'bg-slate-400',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    purple: 'bg-brand-purple',
    orange: 'bg-brand-orange',
    outline: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', dots[variant])} />}
      {children}
    </span>
  );
};

export const TableStatusBadge: React.FC<{ status: TableStatus }> = ({ status }) => {
  switch (status) {
    case 'AVAILABLE':
      return <Badge variant="success" dot>Available</Badge>;
    case 'OCCUPIED':
      return <Badge variant="purple" dot>Occupied</Badge>;
    case 'PAYMENT_PENDING':
      return <Badge variant="warning" dot className="animate-pulse">Bill Pending</Badge>;
    case 'RESERVED':
      return <Badge variant="default" dot>Reserved</Badge>;
    case 'CLEANING':
      return <Badge variant="orange" dot>Cleaning</Badge>;
    case 'OUT_OF_SERVICE':
    case 'DISABLED':
      return <Badge variant="danger" dot>Out of Service</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus | KitchenTicketStatus }> = ({ status }) => {
  switch (status) {
    case 'PLACED':
    case 'NEW':
      return <Badge variant="warning" dot>New Ticket</Badge>;
    case 'ACCEPTED':
      return <Badge variant="purple" dot>Accepted</Badge>;
    case 'PREPARING':
      return <Badge variant="orange" dot className="animate-pulse">Preparing</Badge>;
    case 'READY':
    case 'READY_FOR_HANDOVER':
      return <Badge variant="success" dot className="animate-pulse">Ready to Serve</Badge>;
    case 'PICKED_UP':
      return <Badge variant="purple" dot>Picked Up</Badge>;
    case 'SERVED':
      return <Badge variant="success">Served</Badge>;
    case 'PAYMENT_PENDING':
      return <Badge variant="warning">Bill Pending</Badge>;
    case 'COMPLETED':
      return <Badge variant="default">Completed</Badge>;
    case 'REJECTED':
    case 'CANCELLED':
      return <Badge variant="danger">Cancelled</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

export const PaymentStatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  switch (status) {
    case 'PAID':
      return <Badge variant="success" dot>Paid</Badge>;
    case 'PENDING':
      return <Badge variant="warning" dot>Payment Pending</Badge>;
    case 'PROCESSING':
      return <Badge variant="purple" dot className="animate-pulse">Processing</Badge>;
    case 'FAILED':
      return <Badge variant="danger" dot>Failed</Badge>;
    case 'REFUNDED':
      return <Badge variant="default">Refunded</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

export const VegNonVegBadge: React.FC<{ isVeg: boolean }> = ({ isVeg }) => {
  return (
    <span
      className={cn(
        'w-4 h-4 border flex items-center justify-center rounded-sm',
        isVeg ? 'border-green-600 bg-white' : 'border-red-600 bg-white'
      )}
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          isVeg ? 'bg-green-600' : 'bg-red-600'
        )}
      />
    </span>
  );
};
