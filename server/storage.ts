import {
  User, Contact, Deal, Task, Activity, DealStage,
  InsertUser, InsertContact, InsertDeal, InsertTask, InsertActivity, InsertDealStage,
  DealWithContact, TaskWithRelations, ActivityWithRelations,
} from "@shared/schema";
import { DatabaseStorage } from "./DatabaseStorage";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Contacts
  getContacts(): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;
  
  // Deal Stages
  getDealStages(): Promise<DealStage[]>;
  getDealStage(id: number): Promise<DealStage | undefined>;
  createDealStage(stage: InsertDealStage): Promise<DealStage>;
  updateDealStage(id: number, stage: Partial<InsertDealStage>): Promise<DealStage | undefined>;
  deleteDealStage(id: number): Promise<boolean>;
  
  // Deals
  getDeals(): Promise<DealWithContact[]>;
  getDeal(id: number): Promise<DealWithContact | undefined>;
  getDealsByStage(stageId: number): Promise<DealWithContact[]>;
  createDeal(deal: InsertDeal): Promise<DealWithContact>;
  updateDeal(id: number, deal: Partial<InsertDeal>): Promise<DealWithContact | undefined>;
  deleteDeal(id: number): Promise<boolean>;
  
  // Tasks
  getTasks(): Promise<TaskWithRelations[]>;
  getTask(id: number): Promise<TaskWithRelations | undefined>;
  getTasksByContact(contactId: number): Promise<TaskWithRelations[]>;
  getTasksByDeal(dealId: number): Promise<TaskWithRelations[]>;
  createTask(task: InsertTask): Promise<TaskWithRelations>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<TaskWithRelations | undefined>;
  deleteTask(id: number): Promise<boolean>;
  
  // Activities
  getActivities(): Promise<ActivityWithRelations[]>;
  getActivity(id: number): Promise<ActivityWithRelations | undefined>;
  getActivitiesByContact(contactId: number): Promise<ActivityWithRelations[]>;
  getActivitiesByDeal(dealId: number): Promise<ActivityWithRelations[]>;
  createActivity(activity: InsertActivity): Promise<ActivityWithRelations>;
  deleteActivity(id: number): Promise<boolean>;
  
  // Dashboard Stats
  getDashboardStats(): Promise<{
    activeDeals: number;
    pipelineValue: number;
    winRate: number;
    newContacts: number;
  }>;
}

// Database-backed storage; no sample-data writes on process startup.
export const storage = new DatabaseStorage();
