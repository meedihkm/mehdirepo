// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE UTILISATEURS
// Gestion des utilisateurs (admin, manager, livreur, cuisine)
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, like, sql, desc, asc, ne } from 'drizzle-orm';
import { db } from '../database';
import { users, deliveries, payments } from '../database/schema';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { hashPassword } from './auth.service';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface CreateUserData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'admin' | 'manager' | 'deliverer' | 'kitchen';
}

interface UpdateUserData {
  name?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════════════

export const listUsers = async (
  organizationId: string,
  params: ListUsersParams
) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    isActive,
    sortBy = 'name',
    sortOrder = 'asc',
  } = params;

  const offset = (page - 1) * limit;

  const conditions = [eq(users.organizationId, organizationId)];

  if (role) {
    conditions.push(eq(users.role, role as any));
  }

  if (typeof isActive === 'boolean') {
    conditions.push(eq(users.isActive, isActive));
  }

  if (search) {
    conditions.push(
      sql`(${users.name} ILIKE ${'%' + search + '%'} OR ${users.email} ILIKE ${'%' + search + '%'})`
    );
  }

  const [data, countResult] = await Promise.all([
    db.query.users.findMany({
      where: and(...conditions),
      columns: {
        passwordHash: false, // Ne jamais retourner le hash
      },
      orderBy: sortOrder === 'desc' 
        ? desc(users[sortBy as keyof typeof users]) 
        : asc(users[sortBy as keyof typeof users]),
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...conditions)),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total: Number(countResult[0]?.count || 0),
      totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL UTILISATEUR
// ═══════════════════════════════════════════════════════════════════════════════

export const getUserById = async (organizationId: string, userId: string) => {
  const user = await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.organizationId, organizationId)
    ),
    columns: {
      passwordHash: false,
    },
  });

  if (!user) {
    throw new NotFoundError('Utilisateur introuvable');
  }

  return user;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION UTILISATEUR
// ═══════════════════════════════════════════════════════════════════════════════

export const createUser = async (
  organizationId: string,
  data: CreateUserData
) => {
  // Vérifier l'unicité de l'email
  const existingEmail = await db.query.users.findFirst({
    where: eq(users.email, data.email.toLowerCase()),
  });

  if (existingEmail) {
    throw new ConflictError('Un utilisateur avec cet email existe déjà');
  }

  const passwordHash = await hashPassword(data.password);

  const [user] = await db
    .insert(users)
    .values({
      id: uuidv4(),
      organizationId,
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name,
      phone: data.phone,
      role: data.role,
      isActive: true,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  return user;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR UTILISATEUR
// ═══════════════════════════════════════════════════════════════════════════════

export const updateUser = async (
  organizationId: string,
  userId: string,
  data: UpdateUserData
) => {
  await getUserById(organizationId, userId);

  const [user] = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(eq(users.id, userId), eq(users.organizationId, organizationId))
    )
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      updatedAt: users.updatedAt,
    });

  return user;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉSACTIVER UTILISATEUR
// ═══════════════════════════════════════════════════════════════════════════════

export const deleteUser = async (
  organizationId: string,
  userId: string,
  _requestedById?: string
) => {
  return deactivateUser(organizationId, userId);
};

export const deactivateUser = async (
  organizationId: string,
  userId: string
) => {
  await getUserById(organizationId, userId);

  await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(users.id, userId), eq(users.organizationId, organizationId))
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RÉINITIALISER MOT DE PASSE (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

export const resetUserPassword = async (
  organizationId: string,
  userId: string,
  newPassword: string
) => {
  await getUserById(organizationId, userId);

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(
      and(eq(users.id, userId), eq(users.organizationId, organizationId))
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES LIVREURS
// ═══════════════════════════════════════════════════════════════════════════════

export const listDeliverers = async (organizationId: string) => {
  return db.query.users.findMany({
    where: and(
      eq(users.organizationId, organizationId),
      eq(users.role, 'deliverer'),
      eq(users.isActive, true)
    ),
    columns: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
    orderBy: asc(users.name),
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE LIVREUR
// ═══════════════════════════════════════════════════════════════════════════════

export const getDelivererPerformance = async (
  organizationId: string,
  userId: string,
  startDate: string,
  endDate: string
) => {
  // Vérifier que c'est bien un livreur
  const user = await getUserById(organizationId, userId);
  if (user.role !== 'deliverer') {
    throw new ValidationError('Cet utilisateur n\'est pas un livreur');
  }

  // Stats livraisons
  const deliveryStats = await db
    .select({
      total: sql<number>`COUNT(*)`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'delivered')`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'failed')`,
      avgDeliveryTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${deliveries.completedAt} - ${deliveries.startedAt})) / 60) FILTER (WHERE ${deliveries.status} = 'delivered')`,
    })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.organizationId, organizationId),
        eq(deliveries.delivererId, userId),
        sql`${deliveries.deliveryDate} >= ${startDate}::date`,
        sql`${deliveries.deliveryDate} <= ${endDate}::date`
      )
    );

  // Stats collections
  const collectionStats = await db
    .select({
      totalCollected: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
      cashCollected: sql<number>`COALESCE(SUM(${payments.amount}) FILTER (WHERE ${payments.mode} = 'cash'), 0)`,
      checksCollected: sql<number>`COALESCE(SUM(${payments.amount}) FILTER (WHERE ${payments.mode} = 'check'), 0)`,
      paymentCount: sql<number>`COUNT(*)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.collectedById, userId),
        sql`${payments.createdAt} >= ${startDate}::date`,
        sql`${payments.createdAt} <= ${endDate}::date + INTERVAL '1 day'`
      )
    );

  // Stats par jour
  const dailyStats = await db.execute(sql`
    SELECT 
      DATE(delivery_date) as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'delivered') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed
    FROM deliveries
    WHERE organization_id = ${organizationId}
      AND deliverer_id = ${userId}
      AND delivery_date >= ${startDate}::date
      AND delivery_date <= ${endDate}::date
    GROUP BY DATE(delivery_date)
    ORDER BY date
  `);

  const stats = deliveryStats[0];
  const collections = collectionStats[0];

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    period: { startDate, endDate },
    deliveries: {
      total: Number(stats?.total) || 0,
      completed: Number(stats?.completed) || 0,
      failed: Number(stats?.failed) || 0,
      successRate: stats?.total 
        ? Math.round((Number(stats.completed) / Number(stats.total)) * 100) 
        : 0,
      avgDeliveryTimeMinutes: stats?.avgDeliveryTime 
        ? Math.round(Number(stats.avgDeliveryTime)) 
        : null,
    },
    collections: {
      total: Number(collections?.totalCollected) || 0,
      cash: Number(collections?.cashCollected) || 0,
      checks: Number(collections?.checksCollected) || 0,
      count: Number(collections?.paymentCount) || 0,
    },
    dailyStats: dailyStats.rows,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// DISPONIBILITÉ LIVREURS
// ═══════════════════════════════════════════════════════════════════════════════

export const getDeliverersAvailability = async (
  organizationId: string,
  date: string
) => {
  const deliverers = await listDeliverers(organizationId);

  const availability = await Promise.all(
    deliverers.map(async (deliverer) => {
      const [stats] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          pending: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} IN ('pending', 'assigned', 'in_transit'))`,
        })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.organizationId, organizationId),
            eq(deliveries.delivererId, deliverer.id),
            sql`${deliveries.deliveryDate} = ${date}::date`
          )
        );

      return {
        ...deliverer,
        assignedDeliveries: Number(stats?.total) || 0,
        pendingDeliveries: Number(stats?.pending) || 0,
      };
    })
  );

  return availability;
};

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE COMPATIBILITÉ (stubs)
// ═══════════════════════════════════════════════════════════════════════════════

export const updateDelivererPosition = async (delivererId: string, location: { lat: number; lng: number }): Promise<void> => {
  await db.update(users)
    .set({ currentLatitude: location.lat, currentLongitude: location.lng, updatedAt: new Date() })
    .where(eq(users.id, delivererId));
};

// Alias pour compatibilité
export const updatePosition = updateDelivererPosition;
export const getPerformance = getDelivererPerformance;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const userService = {
  list: listUsers,
  getById: getUserById,
  create: createUser,
  update: updateUser,
  remove: deactivateUser,
  updatePosition,
  getPerformance,
};

export class UserService {
  static list = listUsers;
  static getById = getUserById;
  static create = createUser;
  static update = updateUser;
  static remove = deactivateUser;
  static updatePosition = updatePosition;
  static getPerformance = getPerformance;
}

export default userService;
