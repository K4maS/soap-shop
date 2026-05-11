import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { User, Phone, Mail, Calendar, LogOut } from 'lucide-react';
import { Input } from '@components/ui/Input';
import { Button } from '@components/ui/Button';
import { Card, CardHeader } from '@components/ui/Card';
import { useAuthStore } from '@store/auth.store';
import { useAuth } from '@hooks/useAuth';
import { patch } from '@api/client';
import { profileUpdateSchema, type ProfileUpdateInput } from '@utils/validation';
import { formatDate, formatPhone } from '@utils/format';
import type { User as UserType } from '@/types';
import toast from 'react-hot-toast';

// =============================================================================
// ProfilePage — user info, edit name/email
// =============================================================================

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProfileUpdateInput) =>
      patch<UserType, ProfileUpdateInput>('/auth/profile', data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setIsEditing(false);
      reset({ name: updatedUser.name ?? '', email: updatedUser.email ?? '' });
      toast.success('Профиль обновлён');
    },
    onError: () => {
      toast.error('Не удалось обновить профиль');
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-serif text-2xl font-bold text-warm-900 mb-8">Мой профиль</h1>

      <div className="space-y-5">
        {/* Profile card */}
        <Card>
          <CardHeader
            title="Личные данные"
            action={
              !isEditing ? (
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                  Редактировать
                </Button>
              ) : undefined
            }
          />

          <div className="mt-5">
            {isEditing ? (
              <form
                onSubmit={handleSubmit((data) => updateMutation.mutate(data))}
                noValidate
                className="space-y-4"
              >
                <Input
                  {...register('name')}
                  label="Имя"
                  placeholder="Ваше имя"
                  autoComplete="name"
                  error={errors.name?.message}
                />
                <Input
                  {...register('email')}
                  label="Email"
                  type="email"
                  placeholder="email@example.com"
                  autoComplete="email"
                  error={errors.email?.message}
                />
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={updateMutation.isPending}
                    disabled={!isDirty}
                  >
                    Сохранить
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      reset();
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="space-y-3">
                <ProfileField
                  icon={<User className="h-4 w-4" aria-hidden="true" />}
                  label="Имя"
                  value={user.name ?? 'Не указано'}
                />
                <ProfileField
                  icon={<Phone className="h-4 w-4" aria-hidden="true" />}
                  label="Телефон"
                  value={formatPhone(user.phone)}
                  note="Изменить номер нельзя"
                />
                <ProfileField
                  icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                  label="Email"
                  value={user.email ?? 'Не указан'}
                />
                <ProfileField
                  icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
                  label="Дата регистрации"
                  value={formatDate(user.createdAt)}
                />
              </dl>
            )}
          </div>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader title="Безопасность" />
          <div className="mt-4 space-y-2 text-sm text-warm-600">
            <p className="flex items-center gap-2">
              <svg className="h-4 w-4 text-sage-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
              Вход только по SMS — пароль не нужен
            </p>
            <p className="flex items-center gap-2">
              <svg className="h-4 w-4 text-sage-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Токены хранятся безопасно (httpOnly cookie)
            </p>
          </div>
        </Card>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          leftIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          Выйти из аккаунта
        </Button>
      </div>
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-warm-400">{icon}</span>
      <div>
        <dt className="text-xs text-warm-400">{label}</dt>
        <dd className="text-sm text-warm-800 font-medium">{value}</dd>
        {note && <p className="text-xs text-warm-400 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}
