import React from 'react';

/**
 * Carson Premium VIP Supporter Accounts
 * Purchased premium illuminated purple & black wave styling
 */
export const VIP_SHORT_IDS = new Set([
  '3H2D6N',
  '21R01G',
  'CAGCUU',
  'KATANA',
  'KFTANI',
  'O2EA45',
  'CARSON',
  'FUYR7K'
]);

export const VIP_UUIDS = new Set([
  '05fd406f-e037-478d-b701-2a92081be680',
  '6ff75b7d-6de2-449a-9777-520de497d7b8',
  'f0d80479-1f11-4af2-89c6-0cc4908e5c92',
  '0909a116-4e5b-42fb-9f7b-ca9b4f776a26',
  '2005bfe2-4cd9-462c-b09c-d870fdf0d6cd',
  '9c34486b-10ab-4e3f-998f-8f72835f65a8',
  '9760c58b-fc34-425a-8d81-a957ad5a75c1',
  'e45990f7-cb60-48c6-b664-41a0d09d25a1'
]);

/**
 * Checks if a player ID (short ID or UUID) is a VIP supporter
 */
export function isVip(idOrShortId?: string | null): boolean {
  if (!idOrShortId) return false;
  const clean = idOrShortId.trim().toUpperCase().replace(/^#+/, '');
  if (VIP_SHORT_IDS.has(clean)) return true;
  return VIP_UUIDS.has(idOrShortId.trim().toLowerCase());
}

/**
 * Checks if a user object is a VIP supporter
 */
export function isVipUser(user?: { id?: string; shortId?: string; name?: string } | null): boolean {
  if (!user) return false;
  return isVip(user.shortId) || isVip(user.id);
}

/**
 * Returns the custom VIP role label
 */
export function getVipRoleLabel(_idOrShortId?: string | null): string {
  return '⚡ SOULLESS';
}

/**
 * Renders username with the purple & black illuminating wave effect if VIP
 */
export const VipUsername: React.FC<{
  name: string;
  idOrShortId?: string | null;
  className?: string;
  vipClassName?: string;
  showIcon?: boolean;
}> = ({ name, idOrShortId, className = '', vipClassName = '', showIcon = true }) => {
  const vip = isVip(idOrShortId);
  if (!vip) {
    return <span className={className}>{name}</span>;
  }

  return (
    <span className={`inline-flex items-center space-x-1 ${vipClassName}`}>
      <span className="text-purple-black-wave font-black tracking-wide filter drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]">
        {name}
      </span>
      {showIcon && (
        <span
          className="text-[10px] text-purple-300 filter drop-shadow-[0_0_5px_rgba(192,132,252,0.9)] animate-pulse select-none"
          title="Premium VIP Supporter"
        >
          ⚡
        </span>
      )}
    </span>
  );
};

/**
 * Renders the illuminating purple & black wave role badge
 */
export const VipBadge: React.FC<{
  idOrShortId?: string | null;
  className?: string;
}> = ({ idOrShortId, className = '' }) => {
  if (!isVip(idOrShortId)) return null;
  const label = getVipRoleLabel(idOrShortId);

  return (
    <span
      className={`badge-purple-wave text-purple-200 font-mono text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(168,85,247,0.4)] flex items-center space-x-1 select-none ${className}`}
    >
      <span>{label}</span>
    </span>
  );
};
