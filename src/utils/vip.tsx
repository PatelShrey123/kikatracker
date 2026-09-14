import React from 'react';

/**
 * Carson & Yip Premium VIP Supporter Accounts
 */
export const VIP_SHORT_IDS = new Set([
  '3H2D6N',
  '21R01G',
  'CAGCUU',
  'KATANA',
  'KFTANI',
  'O2EA45',
  'CARSON',
  'FUYR7K',
  'TTTVBJ'
]);

export const VIP_UUIDS = new Set([
  '05fd406f-e037-478d-b701-2a92081be680',
  '6ff75b7d-6de2-449a-9777-520de497d7b8',
  'f0d80479-1f11-4af2-89c6-0cc4908e5c92',
  '0909a116-4e5b-42fb-9f7b-ca9b4f776a26',
  '2005bfe2-4cd9-462c-b09c-d870fdf0d6cd',
  '9c34486b-10ab-4e3f-998f-8f72835f65a8',
  '9760c58b-fc34-425a-8d81-a957ad5a75c1',
  'e45990f7-cb60-48c6-b664-41a0d09d25a1',
  '57c35b3e-2b0c-4971-b1b3-c6e3271ece0d'
]);

export type VipType = 'yip' | 'souless' | null;

/**
 * Returns VIP tier: 'yip' for #TTTVBJ, 'souless' for Carson & crew, null for others
 */
export function getVipType(idOrShortId?: string | null): VipType {
  if (!idOrShortId) return null;
  const clean = idOrShortId.trim().toUpperCase().replace(/^#+/, '');
  const lower = idOrShortId.trim().toLowerCase();

  if (clean === 'TTTVBJ' || lower === '57c35b3e-2b0c-4971-b1b3-c6e3271ece0d') {
    return 'yip';
  }

  if (VIP_SHORT_IDS.has(clean) || VIP_UUIDS.has(lower)) {
    return 'souless';
  }

  return null;
}

/**
 * Checks if a player ID (short ID or UUID) is a VIP supporter
 */
export function isVip(idOrShortId?: string | null): boolean {
  return getVipType(idOrShortId) !== null;
}

/**
 * Checks if a user object is a VIP supporter
 */
export function isVipUser(user?: { id?: string; shortId?: string; name?: string } | null): boolean {
  if (!user) return false;
  return isVip(user.shortId) || isVip(user.id);
}

/**
 * Returns the custom VIP role label: '⚡ YIP' for #TTTVBJ, '⚡ SOULLESS' for Carson & friends
 */
export function getVipRoleLabel(idOrShortId?: string | null): string {
  const type = getVipType(idOrShortId);
  if (type === 'yip') return '⚡ YIP';
  if (type === 'souless') return '⚡ SOULLESS';
  return '';
}

/**
 * Returns text color / wave animation class:
 * Yip: Electric Blue & Cyan (#527eff / #c0f5ff)
 * Souless: Illuminated Purple & Black
 */
export function getVipTextClass(idOrShortId?: string | null): string {
  const type = getVipType(idOrShortId);
  if (type === 'yip') return 'text-yip-blue-wave';
  if (type === 'souless') return 'text-purple-black-wave';
  return '';
}

/**
 * Returns badge pill styling class
 */
export function getVipBadgeClass(idOrShortId?: string | null): string {
  const type = getVipType(idOrShortId);
  if (type === 'yip') return 'badge-yip-blue-wave text-cyan-200';
  if (type === 'souless') return 'badge-purple-wave text-purple-200';
  return '';
}

/**
 * Returns chip styling class for search bars / headers
 */
export function getVipChipClass(idOrShortId?: string | null): string {
  const type = getVipType(idOrShortId);
  if (type === 'yip') return 'chip-yip-wave text-cyan-200';
  if (type === 'souless') return 'chip-purple-wave text-purple-200';
  return '';
}

/**
 * Renders username with the illuminated wave effect if VIP
 */
export const VipUsername: React.FC<{
  name: string;
  idOrShortId?: string | null;
  className?: string;
  vipClassName?: string;
  showIcon?: boolean;
}> = ({ name, idOrShortId, className = '', vipClassName = '', showIcon = true }) => {
  const type = getVipType(idOrShortId);
  if (!type) {
    return <span className={className}>{name}</span>;
  }

  const textClass = type === 'yip' ? 'text-yip-blue-wave' : 'text-purple-black-wave';
  const iconColor = type === 'yip' ? 'text-cyan-300' : 'text-purple-300';
  const iconGlow = type === 'yip' ? 'drop-shadow-[0_0_6px_rgba(192,245,255,0.9)]' : 'drop-shadow-[0_0_5px_rgba(192,132,252,0.9)]';

  return (
    <span className={`inline-flex items-center space-x-1 ${vipClassName}`}>
      <span className={`${textClass} font-black tracking-wide`}>
        {name}
      </span>
      {showIcon && (
        <span
          className={`text-[10px] ${iconColor} filter ${iconGlow} animate-pulse select-none`}
          title={`Premium VIP Supporter (${type === 'yip' ? 'Yip' : 'Souless'})`}
        >
          ⚡
        </span>
      )}
    </span>
  );
};

/**
 * Renders the illuminating wave role badge
 */
export const VipBadge: React.FC<{
  idOrShortId?: string | null;
  className?: string;
}> = ({ idOrShortId, className = '' }) => {
  const type = getVipType(idOrShortId);
  if (!type) return null;
  const label = getVipRoleLabel(idOrShortId);
  const badgeClass = getVipBadgeClass(idOrShortId);

  return (
    <span
      className={`${badgeClass} font-mono text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded flex items-center space-x-1 select-none ${className}`}
    >
      <span>{label}</span>
    </span>
  );
};
